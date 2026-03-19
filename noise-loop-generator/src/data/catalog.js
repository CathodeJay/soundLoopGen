// src/data/catalog.js
// Sound catalog — 7 entries for v1.
// Path convention: noise worklet = /worklets/{id}-noise-processor.js
//                  sample file   = /samples/{id}.wav
export const catalog = [
  { id: 'white',   label: 'White Noise', type: 'noise' },
  { id: 'pink',    label: 'Pink Noise',  type: 'noise' },
  { id: 'brown',   label: 'Brown Noise', type: 'noise' },
  { id: 'grey',    label: 'Grey Noise',  type: 'noise' },
  { id: 'rain',    label: 'Rain',        type: 'sample' },
  { id: 'wind',    label: 'Wind',        type: 'sample' },
  { id: 'thunder', label: 'Thunder',     type: 'sample' },
];
