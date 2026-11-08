import React from 'react'
import {hydrateRoot} from 'react-dom/client'
import Shop from './Shop'
hydrateRoot(document.querySelector('#root'),<Shop {...JSON.parse(document.querySelector('#model').textContent)}/>)
