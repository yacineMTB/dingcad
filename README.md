# Dingcad

**Dingcad** is a live-reloading alternative to OpenSCAD—because, let’s face it, OpenSCAD kind of really sucks. With Dingcad, development is interactive and fast.

## Getting Started

1. Clone the repo, then run:

   ```bash
   ./run.sh
   ```

2. Edit `scene.js` and watch your changes update live.

## Dependencies

- **raylib**
- **manifoldcad**
- **quickjs**

To set up **raylib** on your system, consult an LLM (or your favorite search engine).  
For **quickjs** and **manifoldcad**, just run:

```bash
git submodule update --init --recursive
```

## Notes

- This repository is mostly written autonomously by an LLM, prompted while I watch YouTube and hang out with my family.
- There are no docs. Just read the code.

Enjoy hacking!
