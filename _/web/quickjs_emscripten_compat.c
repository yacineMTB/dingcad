/* Emscripten compatibility implementation for QuickJS
 * Provides missing POSIX definitions for Emscripten builds
 */

#ifdef __EMSCRIPTEN__

#include <stdlib.h>

/* Provide environ - Emscripten doesn't provide this by default */
/* Use a static empty array as a stub since environ access isn't critical for web builds */
char *empty_environ[] = { NULL };
char **environ = empty_environ;

#endif /* __EMSCRIPTEN__ */

