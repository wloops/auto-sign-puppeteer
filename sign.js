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
    await page.goto(accountConfig.login.url, { waitUntil: 'networkidle2', timeout: 30000 })

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
    await page.waitForSelector(accountConfig.sign.selectors.signIn, { timeout: 15000 })
    await page.click(accountConfig.sign.selectors.signIn)
    await page.waitForSelector('#alertMsgBox', { timeout: 5000 })

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

    await page.waitForSelector(accountConfig.sign.selectors.signOut, { timeout: 15000 })
    await page.click(accountConfig.sign.selectors.signOut)
    await page.waitForSelector('#alertMsgBox', { timeout: 5000 })

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

// 判断是否为工作日的函数
async function isWorkday(date = new Date()) {
  // 获取日期的年、月、日
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

  // 如果配置为使用API获取节假日信息
  if (config.system && config.system.useHolidayApi) {
    // 最多尝试3次API调用
    let retryCount = 0
    const maxRetries = 3

    while (retryCount < maxRetries) {
      try {
        // 尝试使用免费API获取节假日信息
        // 使用 https://timor.tech/api/holiday/info/ API
        log(`尝试获取节假日信息 (尝试 ${retryCount + 1}/${maxRetries})...`)

        // 使用fetch代替axios
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 设置5秒超时

        const response = await fetch(`https://timor.tech/api/holiday/info/${formattedDate}`, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeoutId) // 清除超时计时器

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        log(`获取节假日信息成功: ${JSON.stringify(data)}-${formattedDate}`)

        if (data && data.code === 0) {
          // API返回的工作日类型：
          // 0 - 工作日，1 - 周末，2 - 节假日
          const type = data.type.type

          if (type === 0) {
            log(`${formattedDate} 是工作日`)
            return true
          } else if (type === 1 && data.type.workday) {
            // 周末但需要补班
            log(`${formattedDate} 是需要补班的周末`)
            return true
          } else {
            log(`${formattedDate} 不是工作日`)
            return false
          }
        } else {
          // API返回了结果但格式不符合预期
          log(`API返回格式异常: ${JSON.stringify(data)}，尝试重试`, 'warn')
          retryCount++
          // 等待1秒后重试
          await new Promise((resolve) => setTimeout(resolve, 1000))
          continue
        }
      } catch (error) {
        retryCount++
        if (retryCount >= maxRetries) {
          log(`获取节假日信息失败(已重试${maxRetries}次): ${error.message}，使用默认规则判断`, 'warn')
          break
        } else {
          log(`获取节假日信息失败: ${error.message}，${maxRetries - retryCount}秒后重试...`, 'warn')
          // 等待重试，每次等待时间递增
          await new Promise((resolve) => setTimeout(resolve, retryCount * 1000))
        }
      }
    }
  } else {
    log('根据配置，不使用API获取节假日信息，使用默认规则判断')
  }

  // 如果API调用失败或配置为不使用API，使用默认规则：周一至周五为工作日
  const dayOfWeek = date.getDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  log(`使用默认规则判断 ${formattedDate} ${isWeekday ? '是' : '不是'}工作日`)
  return isWeekday
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
