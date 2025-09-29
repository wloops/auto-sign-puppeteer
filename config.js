/*
 * @Author: Loong wentloop@gmail.com
 * @Date: 2025-04-14 23:13:10
 * @LastEditors: Loong wentloop@gmail.com
 * @LastEditTime: 2025-05-12 08:32:49
 * @FilePath: \auto-sign-puppeteer\config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
module.exports = {
  // 系统配置
  system: {
    // 是否只在工作日执行签到/签退
    workdayOnly: true,
    // 是否使用API获取节假日信息，如果为false则使用默认规则（周一至周五为工作日）
    useHolidayApi: true,
    // 聚合数据ApiKey
    juheApiKey: '7d8fb7c727f8957e83ae0a5a02c21869',
  },

  // 登录配置
  // 支持多账号，每个账号配置为数组中的一个对象
  accounts: [
    {
      name: 'lwl', // 账号名称，用于日志和截图文件夹
      login: {
        url: 'http://795tg1082ff7.vicp.fun/gms-v4/login.jsp?key=developmentServerTest121',
        username: 'lwl', // 替换为实际用户名
        password: 'lwl123', // 替换为实际密码
        selectors: {
          username: '#userID',
          password: '#hisu_password',
          submit: '#submit',
        },
      },
      // 签到配置
      sign: {
        // url: 'http://795tg1082ff7.vicp.fun/gms-v4/main', // 签到页面URL
        selectors: {
          signIn: '#attendSetting', // 需要替换为实际选择器
          signOut: '#exitSetting', // 需要替换为实际选择器
        },
      },
    },
    {
      name: 'llx', // 账号名称，用于日志和截图文件夹
      login: {
        url: 'http://795tg1082ff7.vicp.fun/gms-v4/login.jsp?key=developmentServerTest121',
        username: 'lianglx1', // 替换为实际用户名
        password: 'lianglx1', // 替换为实际密码
        selectors: {
          username: '#userID',
          password: '#hisu_password',
          submit: '#submit',
        },
      },
      // 签到配置
      sign: {
        // url: 'http://795tg1082ff7.vicp.fun/gms-v4/main', // 签到页面URL
        selectors: {
          signIn: '#attendSetting', // 需要替换为实际选择器
          signOut: '#exitSetting', // 需要替换为实际选择器
        },
      },
    },
    {
      name: 'clj', // 账号名称，用于日志和截图文件夹
      login: {
        url: 'http://795tg1082ff7.vicp.fun/gms-v4/login.jsp?key=developmentServerTest121',
        username: 'chenlj', // 替换为实际用户名
        password: '123456', // 替换为实际密码
        selectors: {
          username: '#userID',
          password: '#hisu_password',
          submit: '#submit',
        },
      },
      // 签到配置
      sign: {
        // url: 'http://795tg1082ff7.vicp.fun/gms-v4/main', // 签到页面URL
        selectors: {
          signIn: '#attendSetting', // 需要替换为实际选择器
          signOut: '#exitSetting', // 需要替换为实际选择器
        },
      },
    },
    // 可以添加更多账号
    // {
    //   name: 'account2',
    //   login: { ... },
    //   sign: { ... }
    // }
  ],

  // 保留单账号配置用于向后兼容
  login: {
    url: 'http://795tg1082ff7.vicp.fun/gms-v4/login.jsp?key=developmentServerTest121',
    username: 'lwl', // 替换为实际用户名
    password: 'lwl123', // 替换为实际密码
    selectors: {
      username: '#userID',
      password: '#hisu_password',
      submit: '#submit',
    },
  },

  // 保留单账号签到配置用于向后兼容
  sign: {
    url: 'http://795tg1082ff7.vicp.fun/gms-v4/main', // 签到页面URL
    selectors: {
      signIn: '#attendSetting', // 需要替换为实际选择器
      signOut: '#exitSetting', // 需要替换为实际选择器
    },
  },

  // 定时配置
  schedule: {
    // 签到时间范围配置
    signIn: {
      hour: 8, // 小时
      minStart: 50, // 分钟开始范围
      minEnd: 59, // 分钟结束范围
      cron: '0 8 * * *', // 默认cron表达式（用于兼容）
    },
    // 签退时间范围配置
    signOut: {
      hour: 18, // 小时
      minStart: 50, // 分钟开始范围
      minEnd: 59, // 分钟结束范围
      cron: '0 18 * * *', // 默认cron表达式（用于兼容）
    },
  },

  // 浏览器配置
  browser: {
    headless: false, // 开发时可设为false查看浏览器
    slowMo: 100, // 操作延迟(毫秒)
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
  },
}
