/* Emscripten compatibility header for QuickJS
 * Provides missing POSIX definitions for Emscripten builds
 */

#ifndef QUICKJS_EMSCRIPTEN_COMPAT_H
#define QUICKJS_EMSCRIPTEN_COMPAT_H

#ifdef __EMSCRIPTEN__

/* Define environ - Emscripten doesn't provide this by default */
/* Provide a stub implementation since environ access isn't critical for web builds */
extern char **environ;

/* Define sighandler_t for signal handling */
#ifndef sighandler_t
typedef void (*sighandler_t)(int);
#endif

#endif /* __EMSCRIPTEN__ */

#endif /* QUICKJS_EMSCRIPTEN_COMPAT_H */

