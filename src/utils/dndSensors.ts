import type { MouseEvent } from 'react'
import { MouseSensor } from '@dnd-kit/core'

/**
 * dnd-kit's own MouseSensor only excludes the right-click button (button 2), so a middle-click
 * (mouse wheel button) drag currently activates it too. That gesture is reserved for panning/
 * scrolling instead, so this subclass restricts activation to the primary (left) button only.
 */
export class LeftClickMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: ({ nativeEvent: event }: MouseEvent) => event.button === 0,
    },
  ]
}
