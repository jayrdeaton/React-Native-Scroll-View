import { useContext } from 'react'

import { ScrollViewContext } from './ScrollViewContext'

export const useScrollView = () => {
  const { progress, progressing, scrollHeight, scrollPosition, setProgress, setProgressing } = useContext(ScrollViewContext)
  return { progress, progressing, scrollHeight, scrollPosition, setProgress, setProgressing }
}
