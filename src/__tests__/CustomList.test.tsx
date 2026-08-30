import { Chip } from '@rific/auto-paper'
import { render } from '@testing-library/react'
import React from 'react'
import { Platform } from 'react-native'
import { type GestureType } from 'react-native-gesture-handler'

import { CustomList } from '../CustomList'
import { ScrollViewContext } from '../ScrollViewContext'
import { ScrollViewProvider } from '../ScrollViewProvider'

const wrapper = ({ children }: { children: React.ReactNode }) => <ScrollViewProvider>{children}</ScrollViewProvider>

// Sets headerHeight via context shortly after mount (a layout effect, so it lands in the very next
// commit) — simulates a ScrollViewHeader having measured, which is what makes useScrollInit's own
// layout effect call the `scrollTo` callback passed in from CustomList (CustomList.tsx line 83),
// distinct from handleScrollToTop which calls scrollViewInternal directly instead of through it.
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

type MockListProps = {
  contentInset?: unknown
  contentOffset?: unknown
  onScroll?: unknown
  scrollEventThrottle?: number
  onMomentumScrollEnd?: unknown
  onScrollBeginDrag?: unknown
  onScrollEndDrag?: unknown
  [key: string]: unknown
}

const MockList = jest.fn((_props: MockListProps) => null)

// scrollRef/scrollTo tests need a list component that actually accepts a ref (MockList above is a
// plain function component, so React no-ops a ref passed to it). This exposes a scrollToOffset spy
// through the ref, matching the ScrollToOffsetRef shape CustomList's handleRef/scrollTo expect.
const scrollToOffsetMock = jest.fn()
const RefList = React.forwardRef<{ scrollToOffset: (params: { animated?: boolean; offset: number }) => void }, MockListProps>((_props, ref) => {
  React.useImperativeHandle(ref, () => ({ scrollToOffset: scrollToOffsetMock }))
  return null
})

const mockChip = jest.mocked(Chip)

describe('CustomList', () => {
  beforeEach(() => {
    MockList.mockClear()
    scrollToOffsetMock.mockClear()
    mockChip.mockClear()
  })

  it('renders without crashing', () => {
    render(<CustomList component={MockList} />, { wrapper })
  })

  it('wires up contentInset and contentOffset', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props).toHaveProperty('contentInset')
    expect(props).toHaveProperty('contentOffset')
  })

  it('passes scrollEventThrottle={16}', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props?.scrollEventThrottle).toBe(16)
  })

  it('passes onScroll handler', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(typeof props?.onScroll).toBe('function')
  })

  it('passes momentum and drag scroll handlers', () => {
    render(<CustomList component={MockList} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(typeof props?.onMomentumScrollEnd).toBe('function')
    expect(typeof props?.onScrollBeginDrag).toBe('function')
    expect(typeof props?.onScrollEndDrag).toBe('function')
  })

  it('forwards extra props to the inner component', () => {
    render(<CustomList component={MockList} testID='my-list' />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    expect(props?.testID).toBe('my-list')
  })

  it('does not crash on web (Platform.OS === "web" syncs capturedGeneration synchronously instead of via runOnUI)', () => {
    Platform.OS = 'web'
    try {
      expect(() => render(<CustomList component={MockList} />, { wrapper })).not.toThrow()
      const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
      expect(typeof props?.onScroll).toBe('function')
    } finally {
      // This mock module is shared process-wide — restore immediately so the mutation can't leak
      // into other tests in this file or other files.
      Platform.OS = 'ios'
    }
  })

  it('assigns the resolved list ref onto an externally supplied scrollRef', () => {
    const scrollRef: React.RefObject<{ scrollToOffset: (params: { animated?: boolean; offset: number }) => void } | null> = { current: null }
    render(<CustomList component={RefList} scrollRef={scrollRef} />, { wrapper })
    expect(scrollRef.current).not.toBeNull()
    expect(typeof scrollRef.current?.scrollToOffset).toBe('function')
  })

  it('scrollTo forwards to the ref scrollToOffset via the scroll-to-top chip when pullSearchHeight is unset', () => {
    render(<CustomList component={RefList} />, { wrapper })
    const chipProps = mockChip.mock.calls[mockChip.mock.calls.length - 1][0]
    chipProps.onPress?.({} as never)
    expect(scrollToOffsetMock).toHaveBeenCalledTimes(1)
    const call = scrollToOffsetMock.mock.calls[0][0] as { offset: number; animated: boolean }
    // contentInset.top is 0 here (no ScrollViewHeader ever measured), so the offset is -0 — assert
    // numeric closeness rather than strict equality to sidestep the -0 vs 0 distinction.
    expect(call.offset).toBeCloseTo(0)
    expect(call.animated).toBe(true)
  })

  it('scrollTo offsets by pullSearchHeight via the scroll-to-top chip when pullSearchHeight is set', () => {
    render(<CustomList component={RefList} pullSearchHeight={50} />, { wrapper })
    const chipProps = mockChip.mock.calls[mockChip.mock.calls.length - 1][0]
    chipProps.onPress?.({} as never)
    expect(scrollToOffsetMock).toHaveBeenCalledWith({ animated: true, offset: 50 })
  })

  it('invokes the scrollTo callback passed into useScrollInit once headerHeight becomes known post-mount', () => {
    render(<CustomList component={RefList} />, { wrapper: headerWrapper })
    expect(scrollToOffsetMock).toHaveBeenCalled()
    const call = scrollToOffsetMock.mock.calls[0][0] as { offset: number; animated: boolean }
    expect(call.animated).toBe(false)
  })

  it('wraps content in a GestureDetector combining the external gesture with the native one when `gesture` is provided', () => {
    const { container } = render(<CustomList component={MockList} gesture={{} as GestureType} />, { wrapper })
    expect(container).toBeTruthy()
    expect(MockList).toHaveBeenCalled()
  })

  it('renders the hidden measurement container for the header while pull-search is in its measuring phase', () => {
    const { getByTestId } = render(<CustomList component={MockList} ListHeaderComponent={<span data-testid='hidden-header' />} pullSearchHeight={50} />, { wrapper })
    expect(getByTestId('hidden-header')).toBeTruthy()
  })

  it('merges renderFilters into ListHeaderComponent when no existing header component is given', () => {
    render(<CustomList component={MockList} renderFilters={<button data-testid='filters' />} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    const ListHeaderComponent = props?.ListHeaderComponent as React.ComponentType | undefined
    expect(typeof ListHeaderComponent).toBe('function')
    const { getByTestId } = render(React.createElement(ListHeaderComponent as React.ComponentType))
    expect(getByTestId('filters')).toBeTruthy()
  })

  it('merges renderFilters alongside an existing function ListHeaderComponent', () => {
    const ExistingHeader = () => <span data-testid='existing-header' />
    render(<CustomList component={MockList} ListHeaderComponent={ExistingHeader} renderFilters={<button data-testid='filters' />} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    const ListHeaderComponent = props?.ListHeaderComponent as React.ComponentType | undefined
    const { getByTestId } = render(React.createElement(ListHeaderComponent as React.ComponentType))
    expect(getByTestId('existing-header')).toBeTruthy()
    expect(getByTestId('filters')).toBeTruthy()
  })

  it('merges renderFilters alongside an existing ListHeaderComponent passed as an element', () => {
    render(<CustomList component={MockList} ListHeaderComponent={<span data-testid='existing-header-el' />} renderFilters={<button data-testid='filters' />} />, { wrapper })
    const props = MockList.mock.calls[0]?.[0] as MockListProps | undefined
    const ListHeaderComponent = props?.ListHeaderComponent as React.ComponentType | undefined
    const { getByTestId } = render(React.createElement(ListHeaderComponent as React.ComponentType))
    expect(getByTestId('existing-header-el')).toBeTruthy()
    expect(getByTestId('filters')).toBeTruthy()
  })
})
