# Runtime GPU DirectML do Supertonic

Este diretório contém o backend Windows x64 usado pelo Titi para executar o
Supertonic 3 INT8 na GPU. O runtime é carregado em um `Worker` isolado; o
backend CPU oficial do pacote npm permanece disponível como fallback.

## Proveniência

- `sherpa-onnx-node` e `sherpa-onnx.node`: sherpa-onnx 1.13.5,
  Apache-2.0, pacote npm oficial.
- `sherpa-onnx-c-api.dll` e `sherpa-onnx-cxx-api.dll`: compilados do commit
  sherpa-onnx `3dc7c569f31ca2cd4a20ed6f7db780327e6714c5`, com
  `SHERPA_ONNX_ENABLE_DIRECTML=ON` e `BUILD_SHARED_LIBS=ON`.
- `onnxruntime.dll` e `onnxruntime_providers_shared.dll`: pacote oficial
  `Microsoft.ML.OnnxRuntime.DirectML` 1.24.4. SHA-256 do `.nupkg`:
  `57e9f11b73437bef7a309496135d4c1f96b1a8e9ddba60013fa27bfc1d788681`.
- `DirectML.dll`: pacote oficial `Microsoft.AI.DirectML` 1.15.4. SHA-256 do
  `.nupkg`:
  `4e7cb7ddce8cf837a7a75dc029209b520ca0101470fcdf275c1f49736a3615b9`.

## Integridade dos binários

| Arquivo | SHA-256 |
| --- | --- |
| `DirectML.dll` | `9c9e6d822561c6c41b90e6994b3e8857cf1d66dbfb1e0c4c799c7c89b4e92da1` |
| `onnxruntime.dll` | `e7eedec6a6f26dc39dc948276a75ef6d2bee3fff944d874ceed0bbd3b97bff40` |
| `onnxruntime_providers_shared.dll` | `265c8daf29637cb259cac8be9f08f2cd45f3883f0f0e4949cbfddd5b4cbec3b6` |
| `sherpa-onnx-c-api.dll` | `16e2bf37bcfb8cac1261dd569134538b4c03bd09c87bed9ba63b36e475b6193a` |
| `sherpa-onnx-cxx-api.dll` | `bff174e9602cad51b15299ba01a18693367261cd8a35eb55b91a5134c4fca2a6` |
| `sherpa-onnx.node` | `fe786f8424bd22bc2b1c1394f8c019d06d40aa88410f18ab56d5d225eb10cf51` |

As licenças e os avisos de terceiros redistribuídos estão em `licenses/`.
