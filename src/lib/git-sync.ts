import 'server-only'
import { simpleGit, SimpleGit } from 'simple-git'

export interface GitSyncOptions {
  repositoryPath: string
  commitMessage: string
  branch?: string
  push?: boolean
  authorName?: string
  authorEmail?: string
}

export interface GitSyncResult {
  success: boolean
  commitHash?: string
  pushedToRemote?: boolean
  changes?: {
    staged: string[]
    unstaged: string[]
    untracked: string[]
  }
  error?: string
}

export interface GitStatus {
  success: boolean
  branch?: string
  ahead?: number
  behind?: number
  staged?: string[]
  modified?: string[]
  created?: string[]
  deleted?: string[]
  renamed?: Array<{ from: string; to: string }>
  conflicted?: string[]
  error?: string
}

export async function syncToGit(options: GitSyncOptions): Promise<GitSyncResult> {
  const {
    repositoryPath,
    commitMessage,
    branch = 'main',
    push = false,
    authorName = 'OCD System',
    authorEmail = 'noreply@ocd.local'
  } = options

  try {
    const git = simpleGit(repositoryPath)

    // Check if repo exists
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      throw new Error(`${repositoryPath} is not a git repository`)
    }

    // Get current status
    const status = await git.status()
    
    // Check if there are changes
    const hasChanges = status.files.length > 0
    if (!hasChanges) {
      return {
        success: true,
        changes: {
          staged: [],
          unstaged: [],
          untracked: []
        }
      }
    }

    // Stage all changes
    await git.add('.')

    // Commit with message
    const commitResult = await git.commit(commitMessage, {
      '--author': `${authorName} <${authorEmail}>`
    })

    const result: GitSyncResult = {
      success: true,
      commitHash: commitResult.commit,
      changes: {
        staged: status.staged,
        unstaged: status.not_added,
        untracked: status.created
      }
    }

    // Push if requested
    if (push) {
      try {
        await git.push('origin', branch)
        result.pushedToRemote = true
      } catch (pushError) {
        // Non-fatal: commit succeeded but push failed
        console.error('Push failed:', pushError)
        result.pushedToRemote = false
        result.error = `Commit succeeded but push failed: ${String(pushError)}`
      }
    }

    return result
  } catch (error) {
    console.error('Git sync failed:', error)
    return {
      success: false,
      error: String(error)
    }
  }
}

export async function getGitStatus(repositoryPath: string): Promise<GitStatus> {
  try {
    const git = simpleGit(repositoryPath)
    
    // Check if repo exists
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return {
        success: false,
        error: `${repositoryPath} is not a git repository`
      }
    }
    
    const status = await git.status()
    
    return {
      success: true,
      branch: status.current || undefined,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged,
      modified: status.modified,
      created: status.created,
      deleted: status.deleted,
      renamed: status.renamed,
      conflicted: status.conflicted
    }
  } catch (error) {
    return {
      success: false,
      error: String(error)
    }
  }
}

// Note: generateCommitMessage has been moved to git-utils.ts
// to avoid importing simple-git in client components

