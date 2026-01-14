const puppeteer = require('puppeteer')
const config = require('./config')
const fs = require('fs')
const path = require('path')
const schedule = require('node-schedule')

// 解析命令行参数
const args = process.argv.slice(2)
const runImmediately = args.includes('--now') || args.includes('-n')
const isTest = args.includes('--test')
const forceRun = args.includes('--force') || args.includes('-f')
const runSignOut = args.includes('--signout') || args.includes('-o')

// 创建主日志目录
const baseLogDir = path.join(__dirname, 'logs')
if (!fs.existsSync(baseLogDir)) fs.mkdirSync(baseLogDir)

// 获取账号列表
const accounts = config.accounts || [
  {
    name: 'default',
    login: config.login,
    sign: config.sign,
  },
]

// 为每个账号创建日志目录
accounts.forEach((account) => {
  const accountLogDir = path.join(baseLogDir, account.name)
  if (!fs.existsSync(accountLogDir)) fs.mkdirSync(accountLogDir)
})

// 日志函数
function log(message, level = 'info', accountName = 'system') {
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${accountName}] ${message}\n`
  const logFilePath = path.join(baseLogDir, accountName === 'system' ? 'system.log' : `${accountName}/sign.log`)

  fs.appendFileSync(logFilePath, logMessage)
  console.log(logMessage.trim())
}

// 执行记录管理
function recordExecution(accountName, action, status = 'attempted') {
  const record = {
    date: new Date().toISOString().split('T')[0],
    action: `${action}_${status}`,
    timestamp: new Date().toISOString(),
  }
  const recordPath = path.join(baseLogDir, accountName, 'execution.json')
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2))
}

function hasExecutedToday(accountName, action) {
  const recordPath = path.join(baseLogDir, accountName, 'execution.json')
  if (!fs.existsSync(recordPath)) return false

  try {
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'))
    const today = new Date().toISOString().split('T')[0]
    return record.date === today && record.action.startsWith(action)
  } catch (e) {
    log(`读取执行记录失败: ${e.message}`, 'error', accountName)
    return false
  }
}

// 登录函数
async function login(page, accountConfig, accountName) {
  try {
    log(`导航到登录页面: ${accountConfig.login.url}`, 'info', accountName)
    await page.goto(accountConfig.login.url, { waitUntil: 'networkidle2', timeout: 60000 })

    log('填写登录表单', 'info', accountName)
    await page.type(accountConfig.login.selectors.username, accountConfig.login.username)
    await page.type(accountConfig.login.selectors.password, accountConfig.login.password)

    log('提交登录表单', 'info', accountName)
    await page.click(accountConfig.login.selectors.submit)

    // 检查登录是否成功的方法1：检查URL是否已经改变
    const currentUrl = page.url()
    log(`当前页面URL: ${currentUrl}`)

    // 检查登录是否成功的方法2：检查页面上是否存在登录后才会出现的元素
    // 这里可以根据实际情况调整选择器
    let isLoggedIn = false
    try {
      // 等待一个登录后才会出现的元素，比如主页上的某个元素
      // 如果找不到合适的元素，也可以检查URL是否包含登录成功后的特定路径
      isLoggedIn = currentUrl.includes('/gms-v4/index.jsp') || !currentUrl.includes('/login.jsp')

      if (isLoggedIn) {
        log('登录成功：URL已改变到登录后页面')
      } else {
        // 尝试查找页面上可能存在的错误信息
        const errorTextElement = await page.$('body')
        if (errorTextElement) {
          const errorText = await page.evaluate((el) => el.innerText, errorTextElement)
          log(`页面内容: ${errorText.substring(0, 100)}...`)
        }
        throw new Error('登录可能失败：URL未改变到预期页面')
      }
    } catch (checkError) {
      if (isLoggedIn) {
        // 如果URL检查通过但元素检查失败，仍然认为登录成功
        log('登录可能成功，但无法找到预期元素')
      } else {
        throw checkError
      }
    }
    log('登录成功', 'info', accountName)
    return true
  } catch (error) {
    log(`登录失败: ${error.message}`, 'error', accountName)
    return false
  }
}

// 签到函数
async function signIn(page, accountConfig, accountName) {
  if (!forceRun && hasExecutedToday(accountName, 'signIn')) {
    log(`今日已执行过签到，使用--force参数可强制执行`, 'info', accountName)
    return true
  }

  try {
    log('执行签到操作', 'info', accountName)

    if (isTest) {
      log('测试模式：模拟签到成功', 'info', accountName)
      recordExecution(accountName, 'signIn', 'success')
      return true
    }

    // 实际签到操作
    await page.waitForSelector(accountConfig.sign.selectors.signIn, { timeout: 60000 })
    await page.click(accountConfig.sign.selectors.signIn)
    await page.waitForSelector('#alertMsgBox', { timeout: 60000 })

    recordExecution(accountName, 'signIn', 'success')
    log('签到成功', 'info', accountName)
    return true
  } catch (error) {
    recordExecution(accountName, 'signIn', 'failed')
    log(`签到失败: ${error.message}`, 'error', accountName)
    return false
  }
}

// 签退函数
async function signOut(page, accountConfig, accountName) {
  if (!forceRun && hasExecutedToday(accountName, 'signOut')) {
    log(`今日已执行过签退，使用--force参数可强制执行`, 'info', accountName)
    return true
  }

  try {
    log('执行签退操作', 'info', accountName)

    if (isTest) {
      log('测试模式：模拟签退成功', 'info', accountName)
      recordExecution(accountName, 'signOut', 'success')
      return true
    }

    await page.waitForSelector(accountConfig.sign.selectors.signOut, { timeout: 60000 })
    await page.click(accountConfig.sign.selectors.signOut)
    await page.waitForSelector('#alertMsgBox', { timeout: 60000 })

    recordExecution(accountName, 'signOut', 'success')
    log('签退成功', 'info', accountName)
    return true
  } catch (error) {
    recordExecution(accountName, 'signOut', 'failed')
    log(`签退失败: ${error.message}`, 'error', accountName)
    return false
  }
}

// 主执行函数
async function executeSignIn() {
  let browser
  try {
    browser = await puppeteer.launch(config.browser)

    for (const account of accounts) {
      const accountName = account.name
      log(`处理账号: ${accountName}`, 'info', accountName)

      try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1366, height: 768 })

        if (!(await login(page, account, accountName))) continue
        if (!(await signIn(page, account, accountName))) continue

        await page.close()
      } catch (error) {
        log(`处理过程中出错: ${error.message}`, 'error', accountName)
      }
    }
  } finally {
    if (browser) await browser.close()
    log('浏览器已关闭')
  }
}

async function executeSignOut() {
  let browser
  try {
    browser = await puppeteer.launch(config.browser)

    for (const account of accounts) {
      const accountName = account.name
      log(`处理账号: ${accountName}`, 'info', accountName)

      try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1366, height: 768 })

        if (!(await login(page, account, accountName))) continue
        if (!(await signOut(page, account, accountName))) continue

        await page.close()
      } catch (error) {
        log(`处理过程中出错: ${error.message}`, 'error', accountName)
      }
    }
  } finally {
    if (browser) await browser.close()
    log('浏览器已关闭')
  }
}

// isWorkday 函数 - 新版本

/**
 * 判断指定日期是否为工作日。
 * 优先使用聚合数据API进行判断，如果API请求失败或未配置，则回退到默认规则（周一至周五为工作日）。
 * @param {Date} date - 需要判断的日期对象，默认为当前日期。
 * @returns {Promise<boolean>} - 返回一个Promise，解析为true（工作日）或false（非工作日）。
 */
async function isWorkday(date = new Date()) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

  // 检查是否配置为使用API
  if (config.system && config.system.useHolidayApi) {
    const apiKey = config.system.juheApiKey
    if (!apiKey) {
      log('配置了使用API但未提供juheApiKey，将使用默认规则判断工作日', 'warn')
    } else {
      const url = `http://apis.juhe.cn/fapig/calendar/day?date=${formattedDate}&key=${apiKey}`
      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          log(`[聚合API] 正在查询日期 ${formattedDate} 的工作日信息... (尝试 ${retryCount + 1}/${maxRetries})`)
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 15000) // 15秒超时

          const response = await fetch(url, { method: 'GET', signal: controller.signal })
          clearTimeout(timeoutId)

          if (!response.ok) {
            throw new Error(`HTTP请求失败: ${response.status} ${response.statusText}`)
          }

          const data = await response.json()

          if (data && data.error_code === 0) {
            // 请求成功
            const result = data.result
            // status为 '2' 表示工作日, statusDesc 为 '工作日' 表示调休上班
            const isWorkdayByApi = result.status === '2' || result.statusDesc === '工作日'
            log(`[聚合API] 查询成功: ${formattedDate} 是 [${result.statusDesc}]，判断为: ${isWorkdayByApi ? '工作日' : '非工作日'}`)
            return isWorkdayByApi
          } else {
            // API返回业务错误
            throw new Error(`API返回错误: ${data.reason} (error_code: ${data.error_code})`)
          }
        } catch (error) {
          retryCount++
          log(`[聚合API] 查询失败: ${error.message}`, 'error')
          if (retryCount >= maxRetries) {
            log(`[聚合API] 已达到最大重试次数，将使用默认规则判断`, 'warn')
            break // 跳出循环
          }
          log(`[聚合API] ${3 - retryCount}秒后进行重试...`, 'warn')
          await new Promise((resolve) => setTimeout(resolve, (3 - retryCount) * 1000))
        }
      }
    }
  }

  // API调用失败或未配置API，则使用默认规则
  log('使用默认规则判断工作日', 'info')
  const dayOfWeek = date.getDay() // 0是周日, 6是周六
  const isDefaultWorkday = dayOfWeek >= 1 && dayOfWeek <= 5
  log(`默认规则判断: ${formattedDate} (星期${dayOfWeek}) ${isDefaultWorkday ? '是' : '不是'} 工作日`)
  return isDefaultWorkday
}

async function generateNextWorkdayTime(timeConfig) {
  const { hour, minStart, minEnd } = timeConfig
  const randomMinute = Math.floor(Math.random() * (minEnd - minStart + 1)) + minStart

  const now = new Date()
  let scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, randomMinute)

  // 如果时间已过，设置为明天
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1)
  }

  // 检查是否为工作日
  if (config.system?.workdayOnly) {
    while (!(await isWorkday(scheduledTime))) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }
  }

  return scheduledTime
}

function formatDateTime(date) {
  return {
    fullStr: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`,
  }
}

function scheduleTask(taskType) {
  return (async () => {
    const timeConfig = config.schedule[taskType]
    const scheduledTime = await generateNextWorkdayTime(timeConfig)
    const nextTime = formatDateTime(scheduledTime)

    log(`已设置${taskType === 'signIn' ? '签到' : '签退'}时间: ${nextTime.fullStr}`)

    const job = schedule.scheduleJob(scheduledTime, async () => {
      // 检查是否所有账号都已尝试
      const allAttempted = accounts.every((account) => hasExecutedToday(account.name, taskType))

      if (!forceRun && allAttempted) {
        log(`所有账号今日已尝试${taskType === 'signIn' ? '签到' : '签退'}，跳过`, 'info')
        return
      }

      try {
        if (taskType === 'signIn') await executeSignIn()
        else await executeSignOut()
      } finally {
        // 重新调度
        scheduleTask(taskType)
      }
    })

    return job
  })()
}

// 启动程序
log('启动定时任务...')
scheduleTask('signIn')
scheduleTask('signOut')

process.on('SIGINT', () => {
  log('收到终止信号，退出程序')
  process.exit()
})

if (runImmediately) {
  if (runSignOut) {
    log('立即执行签退流程...')
    executeSignOut()
  } else {
    log('立即执行签到流程...')
    executeSignIn()
  }
} else {
  log('服务已启动，等待定时任务触发...')
  log(`已配置账号: ${accounts.map((a) => a.name).join(', ')}`)
  if (config.system?.workdayOnly) {
    log('注意：任务只会在工作日执行')
  }
}
