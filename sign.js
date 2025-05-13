const puppeteer = require('puppeteer')
const config = require('./config')
const fs = require('fs')
const path = require('path')
const schedule = require('node-schedule')
const axios = require('axios')

// 解析命令行参数
const args = process.argv.slice(2)
const runImmediately = args.includes('--now') || args.includes('-n')
const isTest = args.includes('--test')

// 创建主日志目录
const baseLogDir = path.join(__dirname, 'logs')
const baseScreenshotDir = path.join(__dirname, 'screenshots')
if (!fs.existsSync(baseLogDir)) fs.mkdirSync(baseLogDir)
if (!fs.existsSync(baseScreenshotDir)) fs.mkdirSync(baseScreenshotDir)

// 获取账号列表，如果没有配置accounts，则使用单账号配置
const accounts = config.accounts || [
  {
    name: 'default',
    login: config.login,
    sign: config.sign,
  },
]

// 为每个账号创建日志和截图目录
accounts.forEach((account) => {
  const accountLogDir = path.join(baseLogDir, account.name)
  const accountScreenshotDir = path.join(baseScreenshotDir, account.name)

  if (!fs.existsSync(accountLogDir)) fs.mkdirSync(accountLogDir)
  if (!fs.existsSync(accountScreenshotDir)) fs.mkdirSync(accountScreenshotDir)
})

// 日志函数
function log(message, level = 'info', accountName = 'system') {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${accountName}] ${message}\n`

  // 写入账号特定日志
  const logFilePath = accountName === 'system' ? path.join(baseLogDir, 'system.log') : path.join(baseLogDir, accountName, 'sign.log')

  fs.appendFileSync(logFilePath, logMessage)
  console.log(logMessage.trim())
}

// 登录函数
async function login(page, accountConfig, accountName) {
  try {
    log(`导航到登录页面: ${accountConfig.login.url}`, 'info', accountName)
    await page.goto(accountConfig.login.url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    log('填写登录表单', 'info', accountName)
    await page.type(accountConfig.login.selectors.username, accountConfig.login.username)
    await page.type(accountConfig.login.selectors.password, accountConfig.login.password)

    log('提交登录表单', 'info', accountName)
    await page.click(accountConfig.login.selectors.submit)

    // try {
    //   // 尝试等待导航完成，但不以此作为唯一判断标准
    //   await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    // } catch (navError) {
    //   log(`导航超时，但继续检查登录状态: ${navError.message}`)
    // }

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

    // 截图保存登录后状态
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const loginScreenshot = path.join(accountScreenshotDir, `login-${Date.now()}.png`)
    await page.screenshot({ path: loginScreenshot })
    log(`登录成功，截图已保存: ${loginScreenshot}`, 'info', accountName)

    return true
  } catch (error) {
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const errorScreenshot = path.join(accountScreenshotDir, `login-error-${Date.now()}.png`)
    await page.screenshot({ path: errorScreenshot })
    log(`登录失败: ${error.message}，截图已保存: ${errorScreenshot}`, 'error', accountName)
    return false
  }
}

// 签到函数
async function signIn(page, accountConfig, accountName) {
  try {
    log('在当前页面执行签到操作', 'info', accountName)

    // 测试模式下模拟成功
    if (isTest) {
      log('测试模式：模拟签到成功', 'info', accountName)
      const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
      const signScreenshot = path.join(accountScreenshotDir, `signin-test-${Date.now()}.png`)
      await page.screenshot({ path: signScreenshot })
      log(`测试签到成功，截图已保存: ${signScreenshot}`, 'info', accountName)
      return true
    }

    // 点击签到按钮
    log('查找并点击签到按钮', 'info', accountName)
    const signInButton = await page.waitForSelector(accountConfig.sign.selectors.signIn, { timeout: 5000 })
    await signInButton.click()

    // 等待签到成功弹窗出现
    log('等待签到成功弹窗', 'info', accountName)
    await page.waitForSelector('#alertMsgBox', { timeout: 5000 })

    // 截图记录签到成功状态
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const signScreenshot = path.join(accountScreenshotDir, `signin-${Date.now()}.png`)
    await page.screenshot({ path: signScreenshot })
    log(`签到成功，截图已保存: ${signScreenshot}`, 'info', accountName)

    return true
  } catch (error) {
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const errorScreenshot = path.join(accountScreenshotDir, `signin-error-${Date.now()}.png`)
    await page.screenshot({ path: errorScreenshot })
    log(`签到失败: ${error.message}，截图已保存: ${errorScreenshot}`, 'error', accountName)
    return false
  }
}

// 主执行函数 - 签到
async function executeSignIn() {
  // 测试模式下也启动真实浏览器
  if (isTest) {
    log('测试模式：执行签到流程...')
  }

  log('启动浏览器...')
  let browser
  try {
    browser = await puppeteer.launch(config.browser)

    // 为每个账号执行签到流程
    for (const account of accounts) {
      const accountName = account.name
      log(`开始处理账号: ${accountName} 的签到`, 'info', accountName)

      try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1920, height: 1080 })

        // 登录
        const loginSuccess = await login(page, account, accountName)
        if (!loginSuccess) {
          throw new Error('登录失败，终止签到流程')
        }

        // 签到
        const signInSuccess = await signIn(page, account, accountName)
        if (!signInSuccess) {
          throw new Error('签到失败')
        }

        log(`账号 ${accountName} 自动化签到流程完成`, 'info', accountName)
        await page.close()
      } catch (error) {
        log(`账号 ${accountName} 签到过程中发生错误: ${error.message}`, 'error', accountName)
      }
    }
  } catch (error) {
    log(`浏览器启动失败: ${error.message}`, 'error')
    log('请确保已安装Chrome浏览器，或检查config.js中的browser配置')
  } finally {
    if (browser) {
      await browser.close()
      log('浏览器已关闭')
    }
  }
}

// 签退函数
async function signOut(page, accountConfig, accountName) {
  try {
    log('在当前页面执行签退操作', 'info', accountName)

    // 测试模式下模拟成功
    if (isTest) {
      log('测试模式：模拟签退成功', 'info', accountName)
      const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
      const signOutScreenshot = path.join(accountScreenshotDir, `signout-test-${Date.now()}.png`)
      await page.screenshot({ path: signOutScreenshot })
      log(`测试签退成功，截图已保存: ${signOutScreenshot}`, 'info', accountName)
      return true
    }

    // 点击签退按钮
    log('查找并点击签退按钮', 'info', accountName)
    const signOutButton = await page.waitForSelector(accountConfig.sign.selectors.signOut, { timeout: 5000 })
    await signOutButton.click()

    // 等待签退成功弹窗出现
    log('等待签退成功弹窗', 'info', accountName)
    await page.waitForSelector('#alertMsgBox', { timeout: 5000 })

    // 截图记录签退成功状态
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const signOutScreenshot = path.join(accountScreenshotDir, `signout-${Date.now()}.png`)
    await page.screenshot({ path: signOutScreenshot })
    log(`签退成功，截图已保存: ${signOutScreenshot}`, 'info', accountName)

    return true
  } catch (error) {
    const accountScreenshotDir = path.join(baseScreenshotDir, accountName)
    const errorScreenshot = path.join(accountScreenshotDir, `signout-error-${Date.now()}.png`)
    await page.screenshot({ path: errorScreenshot })
    log(`签退失败: ${error.message}，截图已保存: ${errorScreenshot}`, 'error', accountName)
    return false
  }
}

// 主执行函数 - 签退
async function executeSignOut() {
  // 测试模式下也启动真实浏览器
  if (isTest) {
    log('测试模式：执行签退流程...')
  }

  log('启动浏览器...')
  let browser
  try {
    browser = await puppeteer.launch(config.browser)

    // 为每个账号执行签退流程
    for (const account of accounts) {
      const accountName = account.name
      log(`开始处理账号: ${accountName} 的签退`, 'info', accountName)

      try {
        const page = await browser.newPage()
        await page.setViewport({ width: 1366, height: 768 })

        // 登录
        const loginSuccess = await login(page, account, accountName)
        if (!loginSuccess) {
          throw new Error('登录失败，终止签退流程')
        }

        // 签退
        const signOutSuccess = await signOut(page, account, accountName)
        if (!signOutSuccess) {
          throw new Error('签退失败')
        }

        log(`账号 ${accountName} 自动化签退流程完成`, 'info', accountName)
        await page.close()
      } catch (error) {
        log(`账号 ${accountName} 签退过程中发生错误: ${error.message}`, 'error', accountName)
      }
    }
  } catch (error) {
    log(`浏览器启动失败: ${error.message}`, 'error')
    log('请确保已安装Chrome浏览器，或检查config.js中的browser配置')
  } finally {
    if (browser) {
      await browser.close()
      log('浏览器已关闭')
    }
  }
}

// 原generateRandomTime函数已被generateNextWorkdayTime替代

// 判断是否为工作日的函数
async function isWorkday(date = new Date()) {
  // 获取日期的年、月、日
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

  // 如果配置为使用API获取节假日信息
  if (config.system && config.system.useHolidayApi) {
    try {
      // 尝试使用免费API获取节假日信息
      // 使用 https://timor.tech/api/holiday/info/ API
      const response = await axios.get(`https://timor.tech/api/holiday/info/${formattedDate}`)

      if (response.data && response.data.code === 0) {
        // API返回的工作日类型：
        // 0 - 工作日，1 - 周末，2 - 节假日
        const type = response.data.type.type

        if (type === 0) {
          log(`${formattedDate} 是工作日`)
          return true
        } else if (type === 1 && response.data.type.workday) {
          // 周末但需要补班
          log(`${formattedDate} 是需要补班的周末`)
          return true
        } else {
          log(`${formattedDate} 不是工作日`)
          return false
        }
      }
    } catch (error) {
      log(`获取节假日信息失败: ${error.message}，使用默认规则判断`, 'warn')
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

// 调度签到/签退任务的函数
// 在指定时间范围内生成下一个工作日的随机时间的函数
async function generateNextWorkdayTime(timeConfig) {
  const { hour, minStart, minEnd } = timeConfig
  // 生成minStart到minEnd之间的随机分钟数
  const randomMinute = Math.floor(Math.random() * (minEnd - minStart + 1)) + minStart

  // 创建一个新的Date对象，设置为今天的指定小时和随机分钟
  const now = new Date()
  let scheduledTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, randomMinute)

  // 如果生成的时间已经过去，则设置为明天的同一时间
  if (scheduledTime < now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1)
  }

  // 如果配置为只在工作日执行，则确保调度时间是工作日
  if (config.system && config.system.workdayOnly) {
    // 最多检查未来30天，避免无限循环
    for (let i = 0; i < 30; i++) {
      const isWorkdayResult = await isWorkday(scheduledTime)
      if (isWorkdayResult) {
        // 找到工作日，返回该日期
        return scheduledTime
      }
      // 不是工作日，尝试下一天
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }
    // 如果30天内没找到工作日，仍返回最后一个检查的日期
    log('警告：未来30天内未找到工作日，使用最后检查的日期', 'warn')
    return scheduledTime
  }

  // 如果不要求工作日，直接返回计算的时间
  return scheduledTime
}

function scheduleTask(taskType) {
  const timeConfig = config.schedule[taskType]

  // 异步立即执行函数来处理异步的日期生成
  ;(async () => {
    const scheduledTime = await generateNextWorkdayTime(timeConfig)

    // 格式化日期和时间显示
    const dateStr = `${scheduledTime.getFullYear()}-${(scheduledTime.getMonth() + 1).toString().padStart(2, '0')}-${scheduledTime.getDate().toString().padStart(2, '0')}`
    const timeStr = `${scheduledTime.getHours().toString().padStart(2, '0')}:${scheduledTime.getMinutes().toString().padStart(2, '0')}`
    log(`已设置${taskType === 'signIn' ? '签到' : '签退'}时间: ${dateStr} ${timeStr}`)

    // 创建定时任务
    const job = schedule.scheduleJob(scheduledTime, async () => {
      try {
        // 根据任务类型执行相应的操作
        if (taskType === 'signIn') {
          log('执行签到操作...')
          await executeSignIn()
        } else {
          log('执行签退操作...')
          await executeSignOut()
        }
      } catch (error) {
        log(`执行${taskType === 'signIn' ? '签到' : '签退'}操作时发生错误: ${error.message}`, 'error')
      } finally {
        // 任务执行后，重新调度下一个工作日的任务
        log(`重新调度下一个工作日的${taskType === 'signIn' ? '签到' : '签退'}任务`)
        scheduleTask(taskType)
      }
    })

    return job
  })()
}

// 启动定时任务
log('启动定时任务...')
scheduleTask('signIn') // 调度签到任务
scheduleTask('signOut') // 调度签退任务

// 保持进程运行
process.on('SIGINT', () => {
  log('收到终止信号，退出程序')
  process.exit()
})

// 解析更多命令行参数
const runSignOut = args.includes('--signout') || args.includes('-o')

// 立即执行选项
if (runImmediately) {
  if (runSignOut) {
    log('检测到--now和--signout参数，立即执行签退流程...')
    executeSignOut()
  } else {
    log('检测到--now参数，立即执行签到流程...')
    executeSignIn()
  }
} else {
  log('服务已启动，等待定时任务触发...')
  log('提示：使用 "node sign.js --now" 可立即执行签到流程')
  log('提示：使用 "node sign.js --now --signout" 可立即执行签退流程')
  if (config.system && config.system.workdayOnly) {
    log('注意：根据配置，签到/签退任务只会在工作日执行')
  }
  log(`已配置 ${accounts.length} 个账号：${accounts.map((a) => a.name).join(', ')}`)
}
