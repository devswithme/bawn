// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import '@testing-library/jest-dom'
import { expect, test, vi } from 'vitest'
import { render, getQueriesForElement } from '@lynx-js/react/testing-library'

import { App } from '../App.jsx'

test('App', async () => {
  const cb = vi.fn()

  render(
    <App
      onRender={() => {
        cb(`__MAIN_THREAD__: ${__MAIN_THREAD__}`)
      }}
    />,
  )
  expect(cb).toBeCalledTimes(1)
  expect(cb.mock.calls[0]?.[0]).toBe('__MAIN_THREAD__: false')

  const {
    findByText,
  } = getQueriesForElement(elementTree.root!)
  expect(await findByText('Sensing + Wellbeing Trend Demo')).toBeInTheDocument()
  expect(await findByText('Get Activity')).toBeInTheDocument()
  expect(await findByText('Get Location')).toBeInTheDocument()
  expect(await findByText('Get Battery')).toBeInTheDocument()
  expect(await findByText('Get Usage Stats')).toBeInTheDocument()
  expect(await findByText('Start Audio Stream')).toBeInTheDocument()
  expect(await findByText('Capture + Persist Snapshot')).toBeInTheDocument()
  expect(await findByText('Refresh Change Summary + Risk')).toBeInTheDocument()
  expect(await findByText('Risk Level:')).toBeInTheDocument()
  expect(await findByText('Trend Chart (Last 7 days)')).toBeInTheDocument()
  expect(await findByText('Suggestions')).toBeInTheDocument()
  expect(await findByText('No trend points yet.')).toBeInTheDocument()
})
