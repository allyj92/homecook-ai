// src/App.jsx
import { Routes, Route , Navigate} from 'react-router-dom'
import Layout from './layouts/Layout'
import MainPage from './pages/MainPage'
import InputPage from './pages/InputPage'
import ResultPage from './pages/ResultPage'
import CommunityPage from './pages/CommunityPage'
import WritePage from "./pages/WritePage";
import MyPage from './pages/MyPage'
import LoginPage from './pages/LoginPage'
import ShopPage from './pages/ShopPage'
import AuthBootstrap from './auth/AuthBootstrap' 
import AuthCallback from './pages/AuthCallback'; 
import ForgotResetPage from './pages/ForgotResetPage';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import SavedPage from './pages/SavedPage';

// ⚠️ Header는 Layout 내부에서만 렌더되므로 여기서 import 불필요
// import Header from './compoments/Header'

export default function App() {
  return (
    <Routes>
      {/* 공통 레이아웃(헤더 + <Outlet/>) */}
      <Route element={<><AuthBootstrap /><Layout /></>}>
        {/* "/" */}
        <Route index element={<MainPage />} />

        {/* 자식 경로(상대경로로 작성) */}
        <Route path="input" element={<InputPage />} />
        <Route path="result" element={<ResultPage />} />
        <Route path="/write" element={<WritePage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/:id" element={<div>포스트 상세 (추후 구현)</div>} />
        <Route path="mypage" element={<MyPage />} />
        <Route path="profile" element={<div>프로필 편집(추후)</div>} />
        <Route path="settings" element={<div>계정/보안(추후)</div>} />
        <Route path="activity" element={<div>활동 내역(추후)</div>} />
        <Route path="login-signup" element={<LoginPage />} />
        <Route path="/forgot" element={<ForgotResetPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/saved" element={<SavedPage />} />
       
      <Route path="login" element={<Navigate to="/login-signup" replace />} />
      <Route path="signup" element={<Navigate to="/login-signup" replace />} />
      <Route path="auth/callback" element={<AuthCallback />} />
      

        {/* 쇼핑도 같은 헤더/레이아웃 하에서 */}
        <Route path="shop" element={<ShopPage />} />

        {/* 404 */}
        <Route path="*" element={<div style={{padding:24}}>페이지를 찾을 수 없어요. 😢</div>} />
      </Route>
    </Routes>
  )
}