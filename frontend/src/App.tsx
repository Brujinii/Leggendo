import { useState, useEffect } from 'react'
import { SettingsProvider } from './context/SettingsContext'
import Nav from './components/Nav'
import HomePage from './pages/HomePage'
import ReaderPage from './pages/ReaderPage'
import SettingsPage from './pages/SettingsPage'
import ExportPage from './pages/ExportPage'
import WordsPage from './pages/WordsPage'
import NotesPage from './pages/NotesPage'

type Page = 'home' | 'export' | 'words' | 'notes' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [openArticleId, setOpenArticleId] = useState<number | null>(null)

  const handleNavigate = (p: Page) => {
    console.log('🔵 Navigate to:', p)
    setOpenArticleId(null)
    setPage(p)
  }

  const handleOpenArticle = (id: number) => {
    setOpenArticleId(id);
    setPage('home'); // Ensure that when we go "back", we return to the library
  };

  const handleBackFromReader = () => {
    console.log('⬅️ Back from reader, returning to page:', page)
    setOpenArticleId(null)
  }

  // Debug log
  console.log('🎨 Render - openArticleId:', openArticleId, 'type:', typeof openArticleId, 'page:', page)

  return (
    <SettingsProvider>
      <Nav page={page} onNavigate={handleNavigate} />
      {openArticleId !== null && typeof openArticleId === 'number' ? (
        <ReaderPage
          articleId={openArticleId}
          onBack={handleBackFromReader}
        />
      ) : (
        <>
          {page === 'home' && <HomePage onOpenArticle={handleOpenArticle} />}
          {page === 'words' && <WordsPage onNavigateToArticle={handleOpenArticle} />}
          {page === 'notes' && <NotesPage onNavigateToArticle={handleOpenArticle} />}
          {page === 'export' && <ExportPage />}
          {page === 'settings' && <SettingsPage />}
        </>
      )}
    </SettingsProvider>
  )
}