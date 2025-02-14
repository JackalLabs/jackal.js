import { describe, expect, test } from 'vitest'
import { formatNotification, formatShareNotification } from '@/utils/notifications'

describe('Notification Formatting', () => {
  test('formatNotification should return an object with message', () => {
    const result = formatNotification('Test message')
    expect(result).toEqual({ msg: 'Test message' })
  })

  test('formatShareNotification should format correctly for files', () => {
    const result = formatShareNotification('ulid123', 'testFile', true)
    expect(result.msg).toBe('file|ulid123|testFile')
  })

  test('formatShareNotification should format correctly for folders', () => {
    const result = formatShareNotification('ulid456', 'testFolder', false)
    expect(result.msg).toBe('folder|ulid456|testFolder')
  })
})
