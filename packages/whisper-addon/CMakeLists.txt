cmake_minimum_required(VERSION 3.15)
project(whisper_addon)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Build whisper.cpp as static library
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(WHISPER_BUILD_TESTS OFF CACHE BOOL "" FORCE)

# Enable Metal on macOS for GPU acceleration
if(APPLE)
  set(WHISPER_METAL ON CACHE BOOL "" FORCE)
  set(WHISPER_COREML OFF CACHE BOOL "" FORCE)
  set(GGML_METAL ON CACHE BOOL "" FORCE)
endif()

# Add whisper.cpp
add_subdirectory(whisper.cpp)

# Find Node.js and N-API
include_directories(${CMAKE_JS_INC})

# Find node-addon-api headers
execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
  OUTPUT_STRIP_TRAILING_WHITESPACE
)
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
include_directories(${NODE_ADDON_API_DIR})

# Require N-API version 8
add_definitions(-DNAPI_VERSION=8)

# Create the addon
add_library(${PROJECT_NAME} SHARED src/addon.cpp ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Link whisper
target_link_libraries(${PROJECT_NAME} PRIVATE whisper ${CMAKE_JS_LIB})

# Include whisper headers
target_include_directories(${PROJECT_NAME} PRIVATE 
  ${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp/include
  ${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp/ggml/include
  ${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp/examples
)

# Copy to native directory after build
add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_CURRENT_SOURCE_DIR}/native
  COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:${PROJECT_NAME}> ${CMAKE_CURRENT_SOURCE_DIR}/native/whisper_addon.node
  COMMENT "Copying addon to native directory"
)

# Ad-hoc sign on macOS
if(APPLE)
  add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
    COMMAND codesign -s - ${CMAKE_CURRENT_SOURCE_DIR}/native/whisper_addon.node || true
    COMMENT "Signing addon for macOS"
  )
endif()
