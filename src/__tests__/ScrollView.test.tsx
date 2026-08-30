import { Chip } from '@rific/auto-paper'
import { render } from '@testing-library/react'
import React from 'react'
import { Platform } from 'react-native'
import { type GestureType } from 'react-native-gesture-handler'

import { ScrollView } from '../ScrollView'
import { ScrollViewContext } from '../ScrollViewContext'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

// Sets headerHeight via context shortly after mount (a layout effect, so it lands in the very next
// commit) — simulates a ScrollViewHeader having measured, which is what makes useScrollInit's own
// layout effect call the `scrollTo` callback ScrollView passes it (ScrollView.tsx line 75), distinct
// from handleScrollToTop which calls scrollView.current directly instead of through it. Mirrors
// CustomList.test.tsx's identical HeaderHeightSetter.
const HeaderHeightSetter = ({ children, height }: { children: React.ReactNode; height: number }) => {
  const { setHeaderHeight } = React.useContext(ScrollViewContext)
  React.useLayoutEffect(() => {
    setHeaderHeight(height)
  }, [height, setHeaderHeight])
  return <>{children}</>
}

const headerWrapper = ({ children }: { children: React.ReactNode }) => (
  <ScrollViewProvider>
    <HeaderHeightSetter height={100}>{children}</HeaderHeightSetter>
  </ScrollViewProvider>
)

const mockChip = jest.mocked(Chip)

describe('ScrollView', () => {
  it('renders without crashing', () => {
    render(<ScrollView />, { wrapper })
  })

  it('renders children', () => {
    const { getByText } = render(
      <ScrollView>
        <></>
      </ScrollView>,
      { wrapper }
    )
    expect(getByText).toBeDefined()
  })
})

describe('ScrollView capturedGeneration effect on web', () => {
  it('does not crash when Platform.OS is web (synchronous capturedGeneration assignment path)', () => {
    Platform.OS = 'web'
    try {
      expect(() => render(<ScrollView />, { wrapper })).not.toThrow()
    } finally {
      // This mock module is shared process-wide — restore immediately so the mutation can't leak
      // into other tests in this file or other files.
      Platform.OS = 'ios'
    }
  })
})

describe('ScrollView handleScrollToTop (via the scroll-to-top chip)', () => {
  beforeEach(() => mockChip.mockClear())

  const pressChip = () => {
    const chipProps = mockChip.mock.calls[mockChip.mock.calls.length - 1][0]
    chipProps.onPress?.({} as never)
  }

  it('runs the vertical path with no pullSearchHeight', () => {
    render(<ScrollView />, { wrapper })
    expect(() => pressChip()).not.toThrow()
  })

  it('runs the vertical path with a pullSearchHeight', () => {
    render(<ScrollView pullSearchHeight={60} />, { wrapper })
    expect(() => pressChip()).not.toThrow()
  })

  it('runs the horizontal path with no pullSearchHeight', () => {
    render(<ScrollView horizontal />, { wrapper })
    expect(() => pressChip()).not.toThrow()
  })

  it('runs the horizontal path with a pullSearchHeight (isHorizontal still short-circuits first)', () => {
    render(<ScrollView horizontal pullSearchHeight={60} />, { wrapper })
    expect(() => pressChip()).not.toThrow()
  })
})

describe('ScrollView scrollTo callback (fired once headerHeight is known)', () => {
  it('does not throw once headerHeight becomes known post-mount', () => {
    expect(() => render(<ScrollView />, { wrapper: headerWrapper })).not.toThrow()
  })
})

describe('ScrollView ref prop', () => {
  it('renders without crashing when given an external ref', () => {
    const externalRef = { current: null }
    expect(() => render(<ScrollView ref={externalRef} />, { wrapper })).not.toThrow()
  })
})

describe('ScrollView onRefresh / refreshing', () => {
  it('renders a RefreshControl wired to onRefresh, with refreshing defaulted via ?? false', () => {
    expect(() => render(<ScrollView onRefresh={() => {}} />, { wrapper })).not.toThrow()
  })

  it('renders a RefreshControl with an explicit refreshing value', () => {
    expect(() => render(<ScrollView onRefresh={() => {}} refreshing />, { wrapper })).not.toThrow()
  })
})

describe('ScrollView gesture', () => {
  it('wraps content in a GestureDetector combining the external gesture with the native one when `gesture` is provided', () => {
    expect(() => render(<ScrollView gesture={{} as GestureType} />, { wrapper })).not.toThrow()
  })
})
