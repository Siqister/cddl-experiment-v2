# CDDL experiment v2

## Installation
Run `npm install` followed by `npm start`

## API
`src/gl` is a self contained module that (hopefully) plays well with other parts of the frontend framework. The module exports a `GLModule` class with the following API

### `GLModule(*ctx*)`
Returns a `GLModule` instance, `glModule`. `ctx` is required to be a `WebGL2` context. See `src/index.js` for usage example.

### `glModule.setSize([w,h])`

### `glModule.setProportions(*array*)`

### `glModule.separateByCat(*boolean*)`

### `glModule.setInstances(*Number*)`

Other API methods are available--take a look at `src/gl/index.js`. Most of these methods return the module instance itself, which enables method chaining.

## Other notes
If you select the "separate by categories" UI option, the vis transitions to a "columns" layout. You can test out different layout options on line 259 of `src/gl/index.js`.

If you use the columns layout, make sure to set the radial and angular forces to 0. Otherwise the layout gets distorted.