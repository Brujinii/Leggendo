// frontend/src/components/FolderTree.tsx

import { useState } from 'react'
import type { Article } from '../types'

interface FolderTreeProps {
  lang: string
  paths: Map<string, Article[]>
  collapsed: Set<string>
  onToggleFolder: (key: string) => void
  onOpenArticle: (id: number) => void
  onEditArticle: (e: React.MouseEvent, article: Article) => void
  onDeleteArticle: (e: React.MouseEvent, id: number) => void
  formatDate: (iso: string | null) => string
  LANGUAGES: Record<string, string>
}

interface TreeNode {
  name: string
  fullPath: string
  articles: Article[]
  children: Map<string, TreeNode>
}

function buildTree(paths: Map<string, Article[]>): TreeNode[] {
  const root: Map<string, TreeNode> = new Map()
  
  for (const [path, articles] of paths) {
    if (!path) {
      // Uncategorized articles
      if (!root.has('')) {
        root.set('', { name: '', fullPath: '', articles: [], children: new Map() })
      }
      root.get('')!.articles.push(...articles)
      continue
    }
    
    const parts = path.split('/')
    let currentMap = root
    let currentFullPath = ''
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentFullPath = currentFullPath ? `${currentFullPath}/${part}` : part
      
      if (!currentMap.has(currentFullPath)) {
        currentMap.set(currentFullPath, {
          name: part,
          fullPath: currentFullPath,
          articles: [],
          children: new Map()
        })
      }
      
      if (i === parts.length - 1) {
        // Last part - add articles here
        currentMap.get(currentFullPath)!.articles.push(...articles)
      } else {
        // Move into children
        const nextMap = currentMap.get(currentFullPath)!.children
        currentMap = nextMap
      }
    }
  }
  
  return Array.from(root.values())
}

// Calculate total articles in a node including all children
function getTotalArticleCount(node: TreeNode): number {
  let total = node.articles.length
  for (const child of node.children.values()) {
    total += getTotalArticleCount(child)
  }
  return total
}

export default function FolderTree({
  lang,
  paths,
  collapsed,
  onToggleFolder,
  onOpenArticle,
  onEditArticle,
  onDeleteArticle,
  formatDate,
  LANGUAGES
}: FolderTreeProps) {
  // Track which folders are expanded (show children)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  
  const toggleExpand = (fullPath: string, hasChildren: boolean) => {
    if (hasChildren) {
      setExpandedPaths(prev => {
        const next = new Set(prev)
        if (next.has(fullPath)) {
          next.delete(fullPath)
        } else {
          next.add(fullPath)
        }
        return next
      })
    } else {
      // For leaf folders (no children), use the collapsed state
      onToggleFolder(fullPath)
    }
  }
  
  const renderNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.size > 0
    const isExpanded = expandedPaths.has(node.fullPath)
    const isCollapsed = collapsed.has(node.fullPath)
    const showChildren = hasChildren ? isExpanded : !isCollapsed
    const totalCount = getTotalArticleCount(node)
    
    return (
      <div key={node.fullPath || `${lang}_root`} style={{ marginLeft: depth * 16 }}>
        {node.name && (
          <button
            onClick={() => toggleExpand(node.fullPath, hasChildren)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '4px 0', marginBottom: showChildren ? 6 : 0,
            }}
          >
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', color: 'var(--ink-muted)', width: 10 }}>
              {hasChildren ? (isExpanded ? '▼' : '▶') : (isCollapsed ? '▶' : '▼')}
            </span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              📁 {node.name}
            </span>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: 'var(--ink-muted)' }}>
              {totalCount} {totalCount === 1 ? 'article' : 'articles'}
            </span>
          </button>
        )}
        
        {showChildren && (
          <div style={{ paddingLeft: node.name ? 18 : 0 }}>
            {/* Render child folders first */}
            {hasChildren && Array.from(node.children.values())
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(child => renderNode(child, depth + 1))
            }
            
            {/* Render articles directly in this folder (not in subfolders) */}
            {node.articles.map(article => (
              <div key={article.id} onClick={() => onOpenArticle(article.id)}
                style={{
                  background: 'var(--panel-bg)', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '14px 18px', cursor: 'pointer',
                  transition: 'border-color 0.15s', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                  marginBottom: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Lora, serif', fontWeight: 600, fontSize: '1rem', marginBottom: article.subtitle ? 2 : 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {article.title}
                  </div>
                  {article.subtitle && (
                    <div style={{ fontFamily: 'Lora, serif', fontSize: '0.82rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {article.subtitle}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--ink-muted)', fontFamily: 'DM Mono, monospace', flexWrap: 'wrap' }}>
                    <span>{article.word_count.toLocaleString()} words</span>
                    <span>Last read {formatDate(article.last_read_at)}</span>
                    <span>Added {formatDate(article.created_at)}</span>
                    {(article.tags || '').split(' ').filter(t => t && !t.startsWith('@')).map(tag => (
                      <span key={tag} style={{ background: 'var(--accent-light)', color: 'var(--accent)', padding: '0 5px', borderRadius: 3 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={e => onEditArticle(e, article)} style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-muted)',
                    cursor: 'pointer', fontSize: '0.85rem', padding: '4px 8px', borderRadius: '4px',
                  }} title="Edit article">✎</button>
                  <button onClick={e => onDeleteArticle(e, article.id)} style={{
                    background: 'transparent', border: 'none', color: 'var(--ink-muted)',
                    cursor: 'pointer', fontSize: '1rem', padding: '4px 8px', borderRadius: '4px',
                  }} title="Delete article">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  const tree = buildTree(paths)
  
  return (
    <div>
      {tree.map(node => renderNode(node))}
    </div>
  )
}