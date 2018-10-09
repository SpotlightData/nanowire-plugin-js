# Node.js library to use the nanowire pipeline

## Details on how to run

First install the dependencies with:

`npm install`

The following environment variables need to be set:

```
CONTROLLER_BASE_URI
POD_NAME
PLUGIN_ID
``` 

Then the library can be built with:

`npm run build`

## Usage

`import SpotlightPipeline from 'spotlight-pipeline-client'`

```javascript
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