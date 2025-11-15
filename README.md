## Dingcad

Dingcad is a live reloading program that is a replacement for openscad. Becuase openscad kind of really sucks. Try ./run.sh and then updating scene.js

This is dingcad. Dependencies: raylib, manifoldcad, and quickjs. Ask an LLM how to set up raylib on your system. For the quickjs and manifoldcad; you can 

```
git submodule update --init --recursive
```

This repository is mostly autonomously written by an LLM that I've lazily prompted while watching youtube and hanging out with my family.

There are no docs. Just read the code.



### MatCaps

Download MatCaps into `viewer/assets/matcaps/<res>` using the installer script.

- Default (512px):
  ```bash
  python3 scripts/install_matcaps.py
  ```
- 1024px:
  ```bash
  python3 scripts/install_matcaps.py --res 1024
  ```
- Overwrite existing files:
  ```bash
  python3 scripts/install_matcaps.py --overwrite
  ```

Notes:
- Files are placed in `viewer/assets/matcaps/512` or `viewer/assets/matcaps/1024`.
- `viewer/assets/matcaps/` is ignored by git.
- Source sets: [`512`](https://github.com/nidorx/matcaps/tree/master/512), [`1024`](https://github.com/nidorx/matcaps/tree/master/1024).

Use a MatCap in `scene.js` by tagging your geometry with a downloaded texture path:

```javascript
// Example (512px). Pick any PNG from viewer/assets/matcaps/512
export const scene = applyShader(harnessWithConnector, './viewer/assets/matcaps/512/0C430C_257D25_439A43_3C683C-512px.png');
```

