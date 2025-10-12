#----------------------------------------------------------------
# Generated CMake target import file.
#----------------------------------------------------------------

# Commands may need to know the format version.
set(CMAKE_IMPORT_FILE_VERSION 1)

# Import target "manifold::manifold" for configuration ""
set_property(TARGET manifold::manifold APPEND PROPERTY IMPORTED_CONFIGURATIONS NOCONFIG)
set_target_properties(manifold::manifold PROPERTIES
  IMPORTED_LINK_DEPENDENT_LIBRARIES_NOCONFIG "TBB::tbb"
  IMPORTED_LOCATION_NOCONFIG "${_IMPORT_PREFIX}/lib/libmanifold.3.2.1.dylib"
  IMPORTED_SONAME_NOCONFIG "@rpath/libmanifold.3.dylib"
  )

list(APPEND _cmake_import_check_targets manifold::manifold )
list(APPEND _cmake_import_check_files_for_manifold::manifold "${_IMPORT_PREFIX}/lib/libmanifold.3.2.1.dylib" )

# Commands beyond this point should not need to know the version.
set(CMAKE_IMPORT_FILE_VERSION)
