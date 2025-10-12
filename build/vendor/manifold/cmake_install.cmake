# Install script for directory: /Users/kache/Repos/raycad/vendor/manifold

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/usr/local")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "FALSE")
endif()

# Set path to fallback-tool for dependency-resolution.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/Library/Developer/CommandLineTools/usr/bin/objdump")
endif()

if(NOT CMAKE_INSTALL_LOCAL_ONLY)
  # Include the install script for the subdirectory.
  include("/Users/kache/Repos/raycad/build/vendor/manifold/src/cmake_install.cmake")
endif()

if(NOT CMAKE_INSTALL_LOCAL_ONLY)
  # Include the install script for the subdirectory.
  include("/Users/kache/Repos/raycad/build/vendor/manifold/bindings/cmake_install.cmake")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  if(EXISTS "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold/manifoldTargets.cmake")
    file(DIFFERENT _cmake_export_file_changed FILES
         "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold/manifoldTargets.cmake"
         "/Users/kache/Repos/raycad/build/vendor/manifold/CMakeFiles/Export/785856d22a39591bc7de0edcd69334a4/manifoldTargets.cmake")
    if(_cmake_export_file_changed)
      file(GLOB _cmake_old_config_files "$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold/manifoldTargets-*.cmake")
      if(_cmake_old_config_files)
        string(REPLACE ";" ", " _cmake_old_config_files_text "${_cmake_old_config_files}")
        message(STATUS "Old export file \"$ENV{DESTDIR}${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold/manifoldTargets.cmake\" will be replaced.  Removing files [${_cmake_old_config_files_text}].")
        unset(_cmake_old_config_files_text)
        file(REMOVE ${_cmake_old_config_files})
      endif()
      unset(_cmake_old_config_files)
    endif()
    unset(_cmake_export_file_changed)
  endif()
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold" TYPE FILE FILES "/Users/kache/Repos/raycad/build/vendor/manifold/CMakeFiles/Export/785856d22a39591bc7de0edcd69334a4/manifoldTargets.cmake")
  if(CMAKE_INSTALL_CONFIG_NAME MATCHES "^()$")
    file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold" TYPE FILE FILES "/Users/kache/Repos/raycad/build/vendor/manifold/CMakeFiles/Export/785856d22a39591bc7de0edcd69334a4/manifoldTargets-noconfig.cmake")
  endif()
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/cmake/manifold" TYPE FILE FILES
    "/Users/kache/Repos/raycad/build/vendor/manifold/cmake/manifoldConfigVersion.cmake"
    "/Users/kache/Repos/raycad/build/vendor/manifold/manifoldConfig.cmake"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/manifold" TYPE FILE FILES
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/common.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/linalg.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/manifold.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/optional_assert.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/polygon.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/vec_view.h"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/"
    "/Users/kache/Repos/raycad/vendor/manifold/include/manifold/"
    "/Users/kache/Repos/raycad/build/vendor/manifold/include/manifold/version.h"
    )
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/lib/pkgconfig" TYPE FILE FILES "/Users/kache/Repos/raycad/build/vendor/manifold/manifold.pc")
endif()

