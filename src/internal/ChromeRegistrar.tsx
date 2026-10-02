import { useEffect, useId } from 'react'
import type { SharedValue } from 'react-native-reanimated'

import type { ScrollViewChromeHost } from '../ScrollViewChromeContext'

type ChromeRegistrarProps = {
  footerFixed: boolean
  host: ScrollViewChromeHost
  writable: SharedValue<boolean>
}

// Rendered by a hosted ScrollViewProvider as a sibling of its children. It is a component rather
// than a hook call inside the provider because host.useIsActive is itself a hook, and a provider
// only sometimes has a host — mounting this only when hosted keeps the hook order stable.
//
// While its screen is active it claims the host; the provider's scroll handlers only write the
// shared offset (`writable`) while this provider is the claim's owner and nothing has pinned the
// bar. Footer Lock turning on while the stack is hidden reveals it, since the handlers stop writing
// the moment it does and nothing else would ever bring it back.
export const ChromeRegistrar = ({ footerFixed, host, writable }: ChromeRegistrarProps) => {
  const id = useId()
  const active = host.useIsActive()
  const { activeId, claim, pinned, release, reveal } = host
  useEffect(() => {
    if (!active) return undefined
    claim(id)
    return () => release(id)
  }, [active, claim, id, release])
  const owner = activeId === id
  useEffect(() => {
    writable.value = owner && !pinned
  }, [owner, pinned, writable])
  useEffect(() => {
    if (owner && footerFixed) reveal()
  }, [footerFixed, owner, reveal])
  return null
}
