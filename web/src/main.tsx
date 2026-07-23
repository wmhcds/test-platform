import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import 'antd/dist/reset.css'
import './index.css'

const theme = {
  token: {
    colorPrimary: '#6366f1',
    borderRadius: 12,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    colorBgLayout: 'transparent',
  },
  components: {
    Card: {
      borderRadiusLG: 16,
    },
    Menu: {
      itemBg: 'transparent',
      itemColor: 'rgba(255,255,255,0.85)',
      itemSelectedColor: '#ffffff',
      itemSelectedBg: 'rgba(255,255,255,0.22)',
      itemHoverBg: 'rgba(255,255,255,0.12)',
      itemBorderRadius: 10,
      itemMarginInline: 8,
    },
    Button: {
      borderRadius: 10,
      fontWeight: 500,
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)
