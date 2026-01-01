/**
 * Whisper.cpp Native Addon for Node.js/Electron
 * 
 * Provides persistent model caching - model is loaded once and kept in memory
 * for fast subsequent transcriptions.
 * 
 * API:
 *   init({ model: string, gpu?: boolean }) -> handle
 *   transcribe(handle, { audio: Float32Array, language?: string }) -> segments
 *   free(handle) -> void
 */

#define NAPI_VERSION 8
#include <napi.h>

#include "whisper.h"

#include <algorithm>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace {

// Handle wrapping whisper context with mutex for thread safety
struct WhisperHandle {
  std::mutex mutex;
  whisper_context* ctx = nullptr;
  bool freed = false;
  std::string model_path;
};

// Wrap handle as Napi External with destructor
Napi::External<WhisperHandle> wrap_handle(Napi::Env env, WhisperHandle* handle) {
  return Napi::External<WhisperHandle>::New(
    env,
    handle,
    [](Napi::Env /*env*/, WhisperHandle* ptr) {
      if (!ptr) return;
      std::lock_guard<std::mutex> guard(ptr->mutex);
      if (!ptr->freed && ptr->ctx) {
        whisper_free(ptr->ctx);
        ptr->ctx = nullptr;
        ptr->freed = true;
      }
      delete ptr;
    });
}

// Unwrap handle from Napi External
WhisperHandle* unwrap_handle(const Napi::CallbackInfo& info, size_t index) {
  if (info.Length() <= index || !info[index].IsExternal()) {
    throw Napi::TypeError::New(info.Env(), "Invalid context handle");
  }
  return info[index].As<Napi::External<WhisperHandle>>().Data();
}

/**
 * Initialize whisper model
 * 
 * Arguments:
 *   options: { model: string, gpu?: boolean }
 * 
 * Returns: External handle to whisper context
 */
Napi::Value init_model(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 1 || !info[0].IsObject()) {
    throw Napi::TypeError::New(env, "Expected options object with 'model' path");
  }

  auto options = info[0].As<Napi::Object>();
  
  if (!options.Has("model") || !options.Get("model").IsString()) {
    throw Napi::TypeError::New(env, "Missing 'model' path in options");
  }

  std::string model_path = options.Get("model").As<Napi::String>();
  
  bool use_gpu = true;
  if (options.Has("gpu")) {
    use_gpu = options.Get("gpu").As<Napi::Boolean>();
  }

  // Configure whisper context
  whisper_context_params cparams = whisper_context_default_params();
  cparams.use_gpu = use_gpu;
  cparams.flash_attn = false; // Disable for compatibility

  // Load model
  whisper_context* ctx = whisper_init_from_file_with_params(model_path.c_str(), cparams);
  if (ctx == nullptr) {
    throw Napi::Error::New(env, "Failed to load whisper model: " + model_path);
  }

  // Create handle
  auto* handle = new WhisperHandle();
  handle->ctx = ctx;
  handle->model_path = model_path;

  return wrap_handle(env, handle);
}

/**
 * Transcribe audio using pre-loaded model
 * 
 * Arguments:
 *   handle: External context handle
 *   options: { audio: Float32Array, language?: string, prompt?: string }
 * 
 * Returns: Array of { text: string, from: number, to: number }
 */
Napi::Value transcribe_audio(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (info.Length() < 2 || !info[1].IsObject()) {
    throw Napi::TypeError::New(env, "Expected (handle, options)");
  }

  WhisperHandle* handle = unwrap_handle(info, 0);
  
  if (handle->freed || handle->ctx == nullptr) {
    throw Napi::Error::New(env, "Model has been freed");
  }

  auto options = info[1].As<Napi::Object>();

  // Extract audio data
  if (!options.Has("audio") || !options.Get("audio").IsTypedArray()) {
    throw Napi::TypeError::New(env, "Missing 'audio' Float32Array in options");
  }

  Napi::Float32Array audio_array = options.Get("audio").As<Napi::Float32Array>();
  std::vector<float> pcmf32(audio_array.ElementLength());
  std::copy(audio_array.Data(), audio_array.Data() + audio_array.ElementLength(), pcmf32.begin());

  // Configure transcription parameters
  whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);
  
  // Language
  std::string language = "en";
  if (options.Has("language") && options.Get("language").IsString()) {
    language = options.Get("language").As<Napi::String>();
  }
  params.language = language.c_str();
  
  // Initial prompt
  std::string prompt;
  if (options.Has("prompt") && options.Get("prompt").IsString()) {
    prompt = options.Get("prompt").As<Napi::String>();
    params.initial_prompt = prompt.c_str();
  }
  
  // Performance settings
  params.n_threads = 4;
  params.print_progress = false;
  params.print_realtime = false;
  params.print_timestamps = false;
  params.no_timestamps = true;
  params.single_segment = false;
  params.suppress_blank = true;
  params.suppress_nst = true;

  // Run transcription with mutex lock
  std::lock_guard<std::mutex> guard(handle->mutex);
  
  int result = whisper_full(
    handle->ctx,
    params,
    pcmf32.data(),
    static_cast<int>(pcmf32.size())
  );

  if (result != 0) {
    throw Napi::Error::New(env, "Transcription failed");
  }

  // Collect segments
  const int n_segments = whisper_full_n_segments(handle->ctx);
  Napi::Array segments = Napi::Array::New(env, n_segments);

  std::string full_text;
  
  for (int i = 0; i < n_segments; ++i) {
    const char* text = whisper_full_get_segment_text(handle->ctx, i);
    int64_t t0 = whisper_full_get_segment_t0(handle->ctx, i);
    int64_t t1 = whisper_full_get_segment_t1(handle->ctx, i);

    Napi::Object segment = Napi::Object::New(env);
    segment.Set("text", Napi::String::New(env, text ? text : ""));
    segment.Set("from", Napi::Number::New(env, static_cast<double>(t0 * 10)));
    segment.Set("to", Napi::Number::New(env, static_cast<double>(t1 * 10)));
    segments.Set(i, segment);
    
    if (text) {
      full_text += text;
    }
  }

  // Create result object
  Napi::Object result_obj = Napi::Object::New(env);
  result_obj.Set("segments", segments);
  result_obj.Set("text", Napi::String::New(env, full_text));
  
  return result_obj;
}

/**
 * Free model from memory
 * 
 * Arguments:
 *   handle: External context handle
 */
Napi::Value free_model(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  WhisperHandle* handle = unwrap_handle(info, 0);

  std::lock_guard<std::mutex> guard(handle->mutex);
  if (!handle->freed && handle->ctx) {
    whisper_free(handle->ctx);
    handle->ctx = nullptr;
    handle->freed = true;
  }

  return env.Undefined();
}

/**
 * Get model info
 * 
 * Arguments:
 *   handle: External context handle
 * 
 * Returns: { loaded: boolean, model: string }
 */
Napi::Value get_info(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  WhisperHandle* handle = unwrap_handle(info, 0);

  Napi::Object result = Napi::Object::New(env);
  result.Set("loaded", Napi::Boolean::New(env, !handle->freed && handle->ctx != nullptr));
  result.Set("model", Napi::String::New(env, handle->model_path));
  
  return result;
}

// Module initialization
Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  exports.Set("init", Napi::Function::New(env, init_model));
  exports.Set("transcribe", Napi::Function::New(env, transcribe_audio));
  exports.Set("free", Napi::Function::New(env, free_model));
  exports.Set("getInfo", Napi::Function::New(env, get_info));
  return exports;
}

NODE_API_MODULE(whisper_addon, InitAll)

} // namespace
