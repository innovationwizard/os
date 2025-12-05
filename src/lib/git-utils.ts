/**
 * Client-safe utility functions for git operations
 * These functions don't require Node.js built-in modules
 */

export function generateCommitMessage(item: {
  title: string
  rawInstructions?: string
  labels?: string[]
  cycleCount?: number
}): string {
  const { title, rawInstructions, labels, cycleCount } = item
  
  let message = title
  
  if (rawInstructions && rawInstructions.length > 0) {
    message += '\n\n' + rawInstructions
  }
  
  if (labels && labels.length > 0) {
    message += '\n\nLabels: ' + labels.join(', ')
  }
  
  if (cycleCount && cycleCount > 0) {
    message += `\n\nCycles: ${cycleCount}`
  }
  
  message += '\n\n🤖 Generated with OCD\nCo-Authored-By: OCD System <noreply@ocd.local>'
  
  return message
}

