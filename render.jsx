import React from 'react'
import {renderToString} from 'react-dom/server'
import Shop from './Shop'
export function render(data){return renderToString(<Shop {...data}/>)}
