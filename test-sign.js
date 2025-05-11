/*
 * @Author: Loong wentloop@gmail.com
 * @Date: 2025-04-14 23:24:04
 * @LastEditors: Loong wentloop@gmail.com
 * @LastEditTime: 2025-04-14 23:36:29
 * @FilePath: \auto-sign-puppeteer\test-sign.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

// 配置参数
const config = {
  loginUrl: 'http://795tg1082ff7.vicp.fun/gms-v4/login.jsp?key=developmentServerTest121',
  signUrl: 'http://795tg1082ff7.vicp.fun/gms-v4/main',
  credentials: {
    username: 'lwl', // 替换为实际用户名
    password: 'lwl123', // 替换为实际密码
  },
  selectors: {
    username: '#userID',
    password: '#hisu_password',
    submit: '#submit',
    // 需要替换为实际的签到按钮选择器
    signInButton: '#attendSetting', // 示例选择器，请替换
    successIndicator: '#exitSetting', // 示例选择器，请替换
  },
  browser: {
    headless: false, // 显示浏览器窗口方便调试
    slowMo: 100, // 操作延迟(毫秒)
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows Chrome路径
    // 或 Mac 的路径: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    // 或 Linux 的路径: '/usr/bin/google-chrome'
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
}

// 创建截图目录
const screenshotDir = path.join(__dirname, 'screenshots')
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir)
}

// 立即执行函数
;(async () => {
  console.log('启动浏览器...')
  const browser = await puppeteer.launch(config.browser)
  const page = await browser.newPage()

  try {
    // 设置视口大小
    await page.setViewport({ width: 1366, height: 768 })

    // 1. 登录
    console.log('导航到登录页面:', config.loginUrl)
    await page.goto(config.loginUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // 截图保存登录前状态
    await page.screenshot({ path: path.join(screenshotDir, 'login-page.png') })

    console.log('填写登录表单')
    await page.type(config.selectors.username, config.credentials.username)
    await page.type(config.selectors.password, config.credentials.password)

    // 截图保存填写后的表单
    await page.screenshot({ path: path.join(screenshotDir, 'login-filled.png') })

    console.log('提交登录表单')
    await page.click(config.selectors.submit)
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })

    // 截图保存登录后状态
    await page.screenshot({ path: path.join(screenshotDir, 'after-login.png') })
    console.log('登录成功')

    // 2. 签到
    console.log('导航到签到页面:', config.signUrl)
    await page.goto(config.signUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // 截图保存签到页面
    await page.screenshot({ path: path.join(screenshotDir, 'sign-page.png') })

    console.log('点击签到按钮')
    // 等待并点击签到按钮
    const signInButton = await page.waitForSelector(config.selectors.signInButton, { timeout: 5000 })
    await signInButton.click()

    // 等待签到成功提示
    await page.waitForSelector(config.selectors.successIndicator, { timeout: 5000 })

    // 截图保存签到结果
    await page.screenshot({ path: path.join(screenshotDir, 'sign-success.png') })
    console.log('签到成功')
  } catch (error) {
    console.error('执行过程中出错:', error)

    // 出错时截图
    const errorScreenshot = path.join(screenshotDir, `error-${Date.now()}.png`)
    await page.screenshot({ path: errorScreenshot })
    console.log('错误截图已保存:', errorScreenshot)
  } finally {
    // 关闭浏览器
    await browser.close()
    console.log('浏览器已关闭')
  }
})()
