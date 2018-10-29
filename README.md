# Node.js Nanowire Library

This is a node.js library which provides a wrapper around Nanowire's controller service. It allows the user to easily fetch and process tasks from Nanowire's pipeline. If you are starting a new project from scratch it is recommended that you use the [Nanowire Python Skeleton Plugin](https://github.com/SpotlightData/nanowire-python-plugin-skeleton) as the basis for your plugin as it is already set up and ready to use.

## Details on how to run

First install the dependencies with:

`yarn install`

The following environment variables need to be set:

```
CONTROLLER_BASE_URI
POD_NAME
PLUGIN_ID
```

Then the library can be built with:

`yarn build`

## Usage

```javascript
import SpotlightPipeline from '@spotlightdata/nanowire-plugin-js';
import { name as pluginName } from '../package.json';

const processMessage = async (nmo, jsonld, url) => {
  return {
    '@type': 'TextDigitalDocument',
  };
};

const client = new SpotlightPipeline({
  taskHandler: processMessage,
  pluginName,
});

client.start();
```

## Task handling

Your handler function must take 3 parameters, 1 the NMO, 2 the jsonld (if any otherwise this will be undefined) and 3 a Minio presigned URL which you can use to get the original file.

Your function must return the JSON-LD that you want to be stored/passed along.
