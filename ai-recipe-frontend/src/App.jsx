// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'
import MainPage from './pages/MainPage'
import InputPage from './pages/InputPage'
import ResultPage from './pages/ResultPage'
import CommunityPage from './pages/CommunityPage'
import WritePage from './pages/WritePage'
import MyPage from './pages/MyPage'
import LoginPage from './pages/LoginPage'
import ShopPage from './pages/ShopPage'
import AuthBootstrap from './auth/AuthBootstrap'
import AuthCallback from './pages/AuthCallback'
import ForgotResetPage from './pages/ForgotResetPage'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import SavedPage from './pages/SavedPage'
import PostDetailPage from './pages/PostDetailPage'
import ActivityPage from './pages/ActivityPage'
import BookmarksPage from './pages/BookmarksPage'
import MyPostsPage from './pages/MyPostsPage'
import RecipeDetailPage from './pages/RecipeDetailPage'

// ✅ 레시피 상세 페이지가 있다면 임포트(없으면 임시 컴포넌트 만들어도 OK)
// import RecipeDetailPage from './pages/RecipeDetailPage'

export default function App() {
  return (
    <Routes>
      <Route element={<><AuthBootstrap /><Layout /></>}>


        {/* 홈 */}
        <Route index element={<MainPage />} />
        <Route path="/search" element={<SearchPage />} />

        {/* ✅ 레시피 상세 */}
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />

        {/* 상대 경로로 통일 */}
        <Route path="input" element={<InputPage />} />
        <Route path="result" element={<ResultPage />} />
        <Route path="write" element={<WritePage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/:id" element={<PostDetailPage />} />

        {/* ✅ 누락된 라우트 추가 */}
        {/* <Route path="recipe/:id" element={<RecipeDetailPage />} /> */}

        <Route path="mypage" element={<MyPage />} />
        <Route path="profile" element={<div>프로필 편집(추후)</div>} />
        <Route path="settings" element={<div>계정/보안(추후)</div>} />
        <Route path="login-signup" element={<LoginPage />} />
        <Route path="forgot" element={<ForgotResetPage />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="login" element={<Navigate to="/login-signup" replace />} />
        <Route path="signup" element={<Navigate to="/login-signup" replace />} />
        <Route path="auth/callback" element={<AuthCallback />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="bookmarks" element={<BookmarksPage />} />
        <Route path="myposts" element={<MyPostsPage />} />
        <Route path="shop" element={<ShopPage />} />

        {/* ❌ 중복 와일드카드 제거하고 하나만 남김(404) */}
        <Route path="*" element={<div style={{padding:24}}>페이지를 찾을 수 없어요. 😢</div>} />
      </Route>
    </Routes>
  )
}
