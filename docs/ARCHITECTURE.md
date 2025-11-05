# Dingcad Architecture

This diagram captures the primary runtime flow and supporting build layers.

```mermaid
classDiagram
    direction LR

    class Editor {
        scene.js
        library modules
    }

    class RunScript {
        QuickJS runtime
        RegisterBindings()
    }

    class Bindings {
        js_bindings.cpp
        exposes manifold API
    }

    class ManifoldCore {
        Geometry operations
        MeshGL output
    }

    class ViewerApp {
        viewer/main.cpp
        raylib render loop
        File watcher + hot reload
        STL export
    }

    class Shaders {
        Toon shading
        Outline pass
        Edge composite
    }

    class CI {
        GitHub Actions
        CMake + Ninja build
        ctest smoke
    }

    Editor --> RunScript : Edit + save triggers reload
    RunScript --> Bindings : Calls C++ glue
    Bindings --> ManifoldCore : Construct geometry
    ManifoldCore --> ViewerApp : MeshGL shared_ptr
    ViewerApp --> Shaders : Apply materials
    ViewerApp --> Editor : Status + STL export feedback
    CI --> ViewerApp : Build dingcad_viewer
    CI --> Bindings : Run smoke test
```

Key interactions:

When you edit your JavaScript scene files and hit save, the viewer picks them up and runs them inside its QuickJS runtime. A small bindings layer does the translation work, turning those JS calls into manifold operations and handing back `manifold::Manifold` handles. Manifold produces a mesh that the raylib viewer renders, while the app handles camera controls, toon shading, outlines, and STL export. In continuous integration we install the dependencies, build the executable with CMake and Ninja, and run a smoke test that exercises the QuickJS bindings.
