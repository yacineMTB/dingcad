#pragma once

namespace shaders {

// Outline pass - expands geometry along normals for silhouette edges
inline const char* kOutlineVS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec3 vertexNormal;

uniform mat4 mvp;
uniform float outline;   // world-units thickness

void main()
{
    vec3 pos = vertexPosition + normalize(vertexNormal) * outline;
    gl_Position = mvp * vec4(pos, 1.0);
}
)glsl";

inline const char* kOutlineFS = R"glsl(
#version 330

out vec4 finalColor;
uniform vec4 outlineColor;

void main()
{
    if (gl_FrontFacing) discard;
    finalColor = outlineColor;
}
)glsl";

// Toon (cel) shading - lit 3D pass with optional texture support
inline const char* kToonVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec3 vertexNormal;
in vec2 vertexTexCoord;
uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
uniform mat4 lightSpaceMatrix;
out vec3 vNvs;
out vec3 vVdir;
out vec2 vTexCoord;
out vec4 vLightSpacePos;
void main() {
    vec4 wpos = matModel * vec4(vertexPosition, 1.0);
    vec3 nvs  = mat3(matView) * mat3(matModel) * vertexNormal;
    vNvs      = normalize(nvs);
    vec3 vpos = (matView * wpos).xyz;
    vVdir     = normalize(-vpos);
    vTexCoord = vertexTexCoord;
    vLightSpacePos = lightSpaceMatrix * wpos;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kToonFS = R"glsl(
#version 330
in vec3 vNvs;
in vec3 vVdir;
in vec2 vTexCoord;
in vec4 vLightSpacePos;
out vec4 finalColor;

uniform vec3 lightDirVS;
uniform vec4 baseColor;
uniform int  toonSteps;
uniform float ambient;
uniform float diffuseWeight;
uniform float rimWeight;
uniform float specWeight;
uniform float specShininess;
uniform sampler2D albedoTex;
uniform int useTexture;
uniform sampler2D shadowMap;
uniform int useShadows;

float quantize(float x, int steps){
    float s = max(1, steps-1);
    return floor(clamp(x,0.0,1.0)*s + 1e-4)/s;
}

float calcShadow() {
    if (useShadows == 0) return 1.0;
    vec3 projCoords = vLightSpacePos.xyz / vLightSpacePos.w;
    projCoords = projCoords * 0.5 + 0.5;
    if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
        projCoords.y < 0.0 || projCoords.y > 1.0) return 1.0;

    float currentDepth = projCoords.z;
    float bias = 0.003;
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 sampleCoord = projCoords.xy + vec2(x, y) * texelSize * 2.0;
            vec2 packed = texture(shadowMap, sampleCoord).rg;
            float closestDepth = packed.r + packed.g / 255.0;
            shadow += currentDepth - bias > closestDepth ? 0.0 : 1.0;
        }
    }
    shadow /= 9.0;
    return smoothstep(0.0, 1.0, shadow);
}

void main() {
    vec3 n   = normalize(vNvs);
    vec3 l   = normalize(lightDirVS);
    vec3 v   = normalize(vVdir);

    vec3 albedo = baseColor.rgb;
    if (useTexture > 0) {
        albedo = texture(albedoTex, vTexCoord).rgb * baseColor.rgb;
    }

    float shadow = calcShadow();
    float ndl = max(0.0, dot(n,l));
    float cel = quantize(ndl * shadow, toonSteps);

    float rim = pow(1.0 - max(0.0, dot(n, v)), 1.5);

    float spec = pow(max(0.0, dot(reflect(-l, n), v)), specShininess);
    spec = step(0.5, spec) * specWeight * shadow;

    float shade = clamp(ambient + diffuseWeight*cel + rimWeight*rim + spec, 0.0, 1.0);
    finalColor  = vec4(albedo * shade, 1.0);
}
)glsl";

// Normal+Depth G-buffer for screen-space edges
inline const char* kNormalDepthVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec3 vertexNormal;
uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
out vec3 nVS;
out float depthLin;
void main() {
    vec4 wpos = matModel * vec4(vertexPosition, 1.0);
    vec3 vpos = (matView * wpos).xyz;
    nVS = normalize(mat3(matView) * mat3(matModel) * vertexNormal);
    depthLin = -vpos.z;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kNormalDepthFS = R"glsl(
#version 330
in vec3 nVS;
in float depthLin;
out vec4 outColor;
uniform float zNear;
uniform float zFar;
void main() {
    float d = clamp((depthLin - zNear) / (zFar - zNear), 0.0, 1.0);
    outColor = vec4(nVS*0.5 + 0.5, d);
}
)glsl";

// Fullscreen edge composite
inline const char* kEdgeQuadVS = R"glsl(
#version 330
in vec3 vertexPosition;
in vec2 vertexTexCoord;
uniform mat4 mvp;
out vec2 uv;
void main() {
    uv = vertexTexCoord;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kEdgeFS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;
uniform sampler2D normDepthTex;
uniform sampler2D ssaoTex;
uniform vec2 texel;

uniform float normalThreshold;
uniform float depthThreshold;
uniform float edgeIntensity;
uniform vec4 inkColor;
uniform float ssaoStrength;  // 0=no SSAO, 1=full SSAO

vec3 decodeN(vec3 c){ return normalize(c*2.0 - 1.0); }

void main(){
    vec4 col = texture(texture0, uv);
    vec4 nd  = texture(normDepthTex, uv);
    vec3 n   = decodeN(nd.rgb);
    float d  = nd.a;

    // Sample SSAO (white=1=no occlusion, black=0=full occlusion)
    float ssao = texture(ssaoTex, uv).r;
    // Blend between no SSAO (1.0) and full SSAO based on strength
    float ssaoFactor = mix(1.0, ssao, ssaoStrength);

    const vec2 offs[8] = vec2[](vec2(-1,-1), vec2(0,-1), vec2(1,-1),
                                vec2(-1, 0),              vec2(1, 0),
                                vec2(-1, 1), vec2(0, 1), vec2(1, 1));
    float maxNDiff = 0.0;
    float maxDDiff = 0.0;
    for (int i=0;i<8;i++){
        vec4 ndn = texture(normDepthTex, uv + offs[i]*texel);
        maxNDiff = max(maxNDiff, length(n - decodeN(ndn.rgb)));
        maxDDiff = max(maxDDiff, abs(d - ndn.a));
    }

    float eN = smoothstep(normalThreshold, normalThreshold*2.5, maxNDiff);
    float eD = smoothstep(depthThreshold,  depthThreshold*6.0,  maxDDiff);
    float edge = clamp(max(eN, eD)*edgeIntensity, 0.0, 1.0);

    // Apply SSAO to color before edge overlay
    vec3 aoColor = col.rgb * ssaoFactor;
    vec3 inked = mix(aoColor, inkColor.rgb, edge);
    finalColor = vec4(inked, col.a);
}
)glsl";

// ============================================================================
// PBR (Physically Based Rendering) Shader
// Cook-Torrance BRDF with GGX distribution, Schlick-GGX geometry, Fresnel-Schlick
// ============================================================================

inline const char* kPBR_VS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec3 vertexNormal;
in vec2 vertexTexCoord;

uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
uniform mat4 matNormal;

out vec3 fragPos;       // World position
out vec3 fragNormal;    // World normal
out vec2 fragTexCoord;
out vec3 viewPos;       // Camera position in world space

void main() {
    vec4 worldPos = matModel * vec4(vertexPosition, 1.0);
    fragPos = worldPos.xyz;

    fragNormal = normalize(transpose(inverse(mat3(matModel))) * vertexNormal);

    fragTexCoord = vertexTexCoord;

    // Get camera position (inverse of view translation)
    viewPos = -vec3(matView[3]) * mat3(matView);

    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kPBR_FS = R"glsl(
#version 330

in vec3 fragPos;
in vec3 fragNormal;
in vec2 fragTexCoord;
in vec3 viewPos;

out vec4 finalColor;

// Material properties
uniform vec4 albedoColor;
uniform float metallic;
uniform float roughness;
uniform float ao;  // ambient occlusion

// Textures
uniform sampler2D albedoTex;
uniform int useAlbedoTex;

// Lighting
uniform vec3 lightDir;      // Directional light direction (normalized, pointing TO light)
uniform vec3 lightColor;    // Light color/intensity
uniform vec3 ambientColor;  // Ambient light color

// Secondary light (fill/rim)
uniform vec3 lightDir2;     // Secondary light direction
uniform vec3 lightColor2;   // Secondary light color (usually dimmer, cooler)

// Environment approximation (simple gradient sky)
uniform vec3 skyColorTop;
uniform vec3 skyColorBottom;
uniform vec3 groundColor;
uniform float exposure;

const float PI = 3.14159265359;

// Normal Distribution Function (GGX/Trowbridge-Reitz)
float DistributionGGX(vec3 N, vec3 H, float rough) {
    float a = rough * rough;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;

    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;

    return nom / max(denom, 0.0001);
}

// Geometry function (Schlick-GGX)
float GeometrySchlickGGX(float NdotV, float rough) {
    float r = rough + 1.0;
    float k = (r * r) / 8.0;

    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;

    return nom / max(denom, 0.0001);
}

// Smith's method for geometry
float GeometrySmith(vec3 N, vec3 V, vec3 L, float rough) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, rough);
    float ggx1 = GeometrySchlickGGX(NdotL, rough);

    return ggx1 * ggx2;
}

// Fresnel equation (Schlick approximation)
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Fresnel with roughness (for IBL)
vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float rough) {
    return F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

// Procedural studio HDRI — adds bright rectangular highlights that metals reflect
vec3 getEnvironmentLight(vec3 N, float rough) {
    float upFactor = N.y * 0.5 + 0.5;
    upFactor = clamp(upFactor, 0.0, 1.0);

    vec3 skyColor;
    if (N.y > 0.0) {
        float t = pow(upFactor, 0.6);
        skyColor = mix(skyColorBottom, skyColorTop, t);
    } else {
        float t = pow(1.0 - upFactor, 0.8);
        skyColor = mix(skyColorBottom, groundColor, t);
    }

    float horizonDist = abs(N.y);
    float horizonGlow = exp(-horizonDist * 3.0) * 0.15;
    skyColor += vec3(1.0, 0.95, 0.9) * horizonGlow;

    // Studio soft-box highlights (two rectangular area lights in upper hemisphere)
    // Convert direction to spherical for highlight placement
    float phi = atan(N.z, N.x);       // azimuth
    float theta = acos(clamp(N.y, -1.0, 1.0));  // polar angle from up

    // Key light soft-box: upper-left area
    float h1_phi = 2.3;   // azimuth position
    float h1_theta = 0.6;  // elevation
    float h1_w = 0.5;      // width
    float h1_h = 0.35;     // height
    float d1_phi = smoothstep(h1_w, 0.0, abs(phi - h1_phi));
    float d1_theta = smoothstep(h1_h, 0.0, abs(theta - h1_theta));
    float highlight1 = d1_phi * d1_theta * 0.6;

    // Fill light soft-box: upper-right, dimmer and wider
    float h2_phi = -0.8;
    float h2_theta = 0.8;
    float h2_w = 0.7;
    float h2_h = 0.4;
    float d2_phi = smoothstep(h2_w, 0.0, abs(phi - h2_phi));
    float d2_theta = smoothstep(h2_h, 0.0, abs(theta - h2_theta));
    float highlight2 = d2_phi * d2_theta * 0.35;

    // Highlights fade with roughness (rough surfaces blur them out)
    float highlightFade = 1.0 - rough * rough;
    vec3 warmWhite = vec3(1.0, 0.97, 0.92);
    skyColor += warmWhite * (highlight1 + highlight2) * highlightFade;

    // Roughness-based blur simulation
    vec3 avgEnv = (skyColorTop + skyColorBottom * 2.0 + groundColor) * 0.25;
    skyColor = mix(skyColor, avgEnv, rough * rough * 0.6);

    return skyColor;
}

// Approximate the split-sum BRDF LUT for specular IBL
vec2 approximateBRDF(float NdotV, float roughness) {
    // Approximation from "Real Shading in Unreal Engine 4" by Brian Karis
    vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
    vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
    vec4 r = roughness * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    return vec2(-1.04, 1.04) * a004 + r.zw;
}

void main() {
    // Get albedo — convert sRGB input to linear for PBR math
    vec3 albedo = pow(albedoColor.rgb, vec3(2.2));
    if (useAlbedoTex > 0) {
        albedo *= texture(albedoTex, fragTexCoord).rgb;
    }

    // Calculate vectors
    vec3 N = normalize(fragNormal);
    vec3 V = normalize(viewPos - fragPos);
    vec3 L = normalize(lightDir);
    vec3 H = normalize(V + L);

    // Calculate reflectance at normal incidence (F0)
    // Dielectrics: 0.04, Metals: albedo color
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metallic);

    // Cook-Torrance BRDF
    float NDF = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    // Specular contribution
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001;
    vec3 specular = numerator / denominator;

    // Energy conservation: diffuse + specular = 1
    vec3 kS = F;  // Specular contribution
    vec3 kD = vec3(1.0) - kS;  // Diffuse contribution
    kD *= 1.0 - metallic;  // Metals have no diffuse

    // Direct lighting from primary light
    float NdotL = max(dot(N, L), 0.0);
    vec3 Lo = (kD * albedo / PI + specular) * lightColor * NdotL;

    // === SECONDARY LIGHT (fill/rim light) ===
    vec3 L2 = normalize(lightDir2);
    vec3 H2 = normalize(V + L2);
    float NDF2 = DistributionGGX(N, H2, roughness);
    float G2 = GeometrySmith(N, V, L2, roughness);
    vec3 F2 = fresnelSchlick(max(dot(H2, V), 0.0), F0);
    vec3 spec2 = (NDF2 * G2 * F2) / (4.0 * max(dot(N, V), 0.0) * max(dot(N, L2), 0.0) + 0.0001);
    vec3 kD2 = (vec3(1.0) - F2) * (1.0 - metallic);
    float NdotL2 = max(dot(N, L2), 0.0);
    vec3 Lo2 = (kD2 * albedo / PI + spec2) * lightColor2 * NdotL2;
    Lo += Lo2;

    // Ambient/Environment lighting (improved IBL approximation)
    float NdotV = max(dot(N, V), 0.0);
    vec3 F_env = fresnelSchlickRoughness(NdotV, F0, roughness);
    vec3 kS_env = F_env;
    vec3 kD_env = (1.0 - kS_env) * (1.0 - metallic);

    // Diffuse irradiance (sample environment at normal direction, fully rough)
    vec3 irradiance = getEnvironmentLight(N, 1.0);
    vec3 diffuseEnv = irradiance * albedo;

    // Specular reflection (sample environment at reflection direction)
    vec3 R = reflect(-V, N);
    vec3 prefilteredColor = getEnvironmentLight(R, roughness);

    // Use proper BRDF LUT approximation instead of guessed values
    vec2 envBRDF = approximateBRDF(NdotV, roughness);
    vec3 specularEnv = prefilteredColor * (F_env * envBRDF.x + envBRDF.y);

    // === SOFT DIRECTIONAL SHADOW WITH FILL LIGHT ===
    float NdotL_shadow = dot(N, L);

    // Soft shadow terminator - gradual transition for natural look
    float shadowTerminator = smoothstep(-0.2, 0.5, NdotL_shadow);

    // Wrap lighting for softer shadows (simulates subsurface/fill)
    float wrapLight = (NdotL_shadow + 0.5) / 1.5;
    wrapLight = clamp(wrapLight, 0.0, 1.0);

    // Combine for soft shadow factor (never fully black)
    float shadowFactor = mix(0.35, 1.0, shadowTerminator * wrapLight);

    // Subtle height-based darkening (very gentle)
    float heightAO = clamp(fragPos.y * 0.15 + 0.9, 0.7, 1.0);

    // Normal-based AO (bottom-facing slightly darker)
    float normalAO = 0.7 + 0.3 * clamp(N.y * 0.5 + 0.5, 0.0, 1.0);

    // Final AO - keep it subtle
    float finalAO = ao * normalAO * heightAO;

    // === ENVIRONMENT REFLECTIONS ===
    vec3 ambientDiffuse = kD_env * diffuseEnv * shadowFactor * 0.5;
    float specBoost = 1.0 + metallic * 2.0 * (1.0 - roughness);
    vec3 ambientSpecular = specularEnv * specBoost;

    vec3 ambient = (ambientDiffuse + ambientSpecular) * finalAO;

    // Direct lighting with shadow (both primary and secondary lights)
    vec3 directLighting = Lo * shadowFactor;

    // Rim/fresnel lighting for depth (stronger for metals)
    float rimPower = mix(3.0, 2.0, metallic);
    float rim = pow(1.0 - NdotV, rimPower) * mix(0.1, 0.25, metallic);
    vec3 rimColor = mix(skyColorTop, vec3(1.0), 0.5) * rim;

    // === FINAL COMPOSITION ===
    vec3 color = ambient + directLighting + rimColor;

    color *= exposure;

    // ACES Filmic tone mapping
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    color = clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);

    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));

    finalColor = vec4(color, 1.0);
}
)glsl";

// ============================================================================
// Gradient Sky Shader
// Renders a gradient sky background
// ============================================================================

inline const char* kSky_VS = R"glsl(
#version 330

in vec3 vertexPosition;

out vec2 uv;

void main() {
    uv = vertexPosition.xy * 0.5 + 0.5;
    gl_Position = vec4(vertexPosition.xy, 0.9999, 1.0);  // Far plane
}
)glsl";

inline const char* kSky_FS = R"glsl(
#version 330

in vec2 uv;
out vec4 finalColor;

uniform vec3 skyTop;
uniform vec3 skyHorizon;
uniform vec3 groundColor;
uniform float sunSize;
uniform vec3 sunDir;

void main() {
    // Gradient based on vertical position
    float t = uv.y;

    vec3 color;
    if (t > 0.5) {
        // Sky (above horizon)
        float skyT = (t - 0.5) * 2.0;
        color = mix(skyHorizon, skyTop, pow(skyT, 0.7));
    } else {
        // Ground (below horizon)
        float groundT = (0.5 - t) * 2.0;
        color = mix(skyHorizon, groundColor, pow(groundT, 0.5));
    }

    // Horizon glow
    float horizonDist = abs(t - 0.5);
    float horizonGlow = exp(-horizonDist * 15.0) * 0.3;
    color += vec3(1.0, 0.95, 0.9) * horizonGlow;

    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));

    finalColor = vec4(color, 1.0);
}
)glsl";

// ============================================================================
// Shadow Map Depth Shader
// Renders depth from light's perspective for shadow mapping
// ============================================================================

inline const char* kShadowDepth_VS = R"glsl(
#version 330

in vec3 vertexPosition;

uniform mat4 mvp;

out float fragDepth;

void main() {
    vec4 clipPos = mvp * vec4(vertexPosition, 1.0);
    gl_Position = clipPos;
    // Pass normalized device coordinate depth (will be in -1 to 1 range)
    fragDepth = clipPos.z / clipPos.w;
}
)glsl";

inline const char* kShadowDepth_FS = R"glsl(
#version 330

in float fragDepth;

out vec4 fragColor;

void main() {
    float depth = fragDepth * 0.5 + 0.5;
    // Pack depth into RG channels for 16-bit precision (vs 8-bit single channel)
    float r = floor(depth * 255.0) / 255.0;
    float g = fract(depth * 255.0);
    fragColor = vec4(r, g, 0.0, 1.0);
}
)glsl";

// ============================================================================
// PBR with Shadows Shader
// Cook-Torrance BRDF with shadow mapping
// ============================================================================

inline const char* kPBRShadow_VS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec3 vertexNormal;
in vec2 vertexTexCoord;

uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 matView;
uniform mat4 lightSpaceMatrix;

out vec3 fragPos;
out vec3 fragNormal;
out vec2 fragTexCoord;
out vec3 viewPos;
out vec4 fragPosLightSpace;

void main() {
    vec4 worldPos = matModel * vec4(vertexPosition, 1.0);
    fragPos = worldPos.xyz;
    fragNormal = normalize(transpose(inverse(mat3(matModel))) * vertexNormal);
    fragTexCoord = vertexTexCoord;
    viewPos = -vec3(matView[3]) * mat3(matView);
    fragPosLightSpace = lightSpaceMatrix * worldPos;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kPBRShadow_FS = R"glsl(
#version 330

in vec3 fragPos;
in vec3 fragNormal;
in vec2 fragTexCoord;
in vec3 viewPos;
in vec4 fragPosLightSpace;

out vec4 finalColor;

// Material properties
uniform vec4 albedoColor;
uniform float metallic;
uniform float roughness;
uniform float ao;

// Textures
uniform sampler2D albedoTex;
uniform int useAlbedoTex;
uniform sampler2D shadowMap;

// Lighting
uniform vec3 lightDir;
uniform vec3 lightColor;

// Secondary light (fill/rim)
uniform vec3 lightDir2;
uniform vec3 lightColor2;

// Environment
uniform vec3 skyColorTop;
uniform vec3 skyColorBottom;
uniform vec3 groundColor;
uniform float exposure;

const float PI = 3.14159265359;

float DistributionGGX(vec3 N, vec3 H, float rough) {
    float a = rough * rough;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return nom / max(denom, 0.0001);
}

float GeometrySchlickGGX(float NdotV, float rough) {
    float r = rough + 1.0;
    float k = (r * r) / 8.0;
    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return nom / max(denom, 0.0001);
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float rough) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    return GeometrySchlickGGX(NdotV, rough) * GeometrySchlickGGX(NdotL, rough);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float rough) {
    return F0 + (max(vec3(1.0 - rough), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 getEnvironmentLight(vec3 N, float rough) {
    float upFactor = N.y * 0.5 + 0.5;
    upFactor = clamp(upFactor, 0.0, 1.0);

    vec3 skyColor;
    if (N.y > 0.0) {
        float t = pow(upFactor, 0.6);
        skyColor = mix(skyColorBottom, skyColorTop, t);
    } else {
        float t = pow(1.0 - upFactor, 0.8);
        skyColor = mix(skyColorBottom, groundColor, t);
    }

    float horizonDist = abs(N.y);
    float horizonGlow = exp(-horizonDist * 3.0) * 0.15;
    skyColor += vec3(1.0, 0.95, 0.9) * horizonGlow;

    float phi = atan(N.z, N.x);
    float theta = acos(clamp(N.y, -1.0, 1.0));
    float d1_phi = smoothstep(0.5, 0.0, abs(phi - 2.3));
    float d1_theta = smoothstep(0.35, 0.0, abs(theta - 0.6));
    float highlight1 = d1_phi * d1_theta * 0.6;
    float d2_phi = smoothstep(0.7, 0.0, abs(phi - (-0.8)));
    float d2_theta = smoothstep(0.4, 0.0, abs(theta - 0.8));
    float highlight2 = d2_phi * d2_theta * 0.35;
    float highlightFade = 1.0 - rough * rough;
    skyColor += vec3(1.0, 0.97, 0.92) * (highlight1 + highlight2) * highlightFade;

    vec3 avgEnv = (skyColorTop + skyColorBottom * 2.0 + groundColor) * 0.25;
    skyColor = mix(skyColor, avgEnv, rough * rough * 0.6);

    return skyColor;
}

vec2 approximateBRDF(float NdotV, float roughness) {
    vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
    vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
    vec4 r = roughness * c0 + c1;
    float a004 = min(r.x * r.x, exp2(-9.28 * NdotV)) * r.x + r.y;
    return vec2(-1.04, 1.04) * a004 + r.zw;
}

float unpackDepth(vec4 rgba) {
    return rgba.r + rgba.g / 255.0;
}

float calculateShadow(vec4 fragPosLS, vec3 normal, vec3 lightDir) {
    vec3 projCoords = fragPosLS.xyz / fragPosLS.w;
    projCoords = projCoords * 0.5 + 0.5;
    projCoords.y = 1.0 - projCoords.y;

    if (projCoords.z > 1.0) return 0.0;
    if (projCoords.x < 0.0 || projCoords.x > 1.0 || projCoords.y < 0.0 || projCoords.y > 1.0) return 0.0;

    float currentDepth = projCoords.z;

    float cosTheta = max(dot(normal, lightDir), 0.0);
    float bias = max(0.03 * (1.0 - cosTheta), 0.003);

    const vec2 poissonDisk[12] = vec2[](
        vec2(-0.94201624, -0.39906216),
        vec2( 0.94558609, -0.76890725),
        vec2(-0.09418410, -0.92938870),
        vec2( 0.34495938,  0.29387760),
        vec2(-0.91588581,  0.45771432),
        vec2(-0.81544232, -0.87912464),
        vec2(-0.38277543,  0.27676845),
        vec2( 0.97484398,  0.75648379),
        vec2( 0.44323325, -0.97511554),
        vec2( 0.53742981, -0.47373420),
        vec2(-0.26496911, -0.41893023),
        vec2( 0.79197514,  0.19090188)
    );

    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    float spread = 3.0;

    for (int i = 0; i < 12; i++) {
        float pcfDepth = unpackDepth(texture(shadowMap, projCoords.xy + poissonDisk[i] * texelSize * spread));
        shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
    }
    shadow /= 12.0;

    // Soften shadow edges (fade penumbra for more natural look)
    shadow = smoothstep(0.0, 1.0, shadow);

    return shadow;
}

void main() {
    // Convert sRGB albedo to linear for PBR math
    vec3 albedo = pow(albedoColor.rgb, vec3(2.2));
    if (useAlbedoTex > 0) {
        albedo *= texture(albedoTex, fragTexCoord).rgb;
    }

    vec3 N = normalize(fragNormal);
    vec3 V = normalize(viewPos - fragPos);
    vec3 L = normalize(lightDir);
    vec3 H = normalize(V + L);

    vec3 F0 = mix(vec3(0.04), albedo, metallic);

    // Cook-Torrance BRDF for primary light
    float NDF = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 specular = (NDF * G * F) / (4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0) + 0.0001);

    vec3 kS = F;
    vec3 kD = (vec3(1.0) - kS) * (1.0 - metallic);

    float NdotL = max(dot(N, L), 0.0);

    // Shadow map
    float shadow = calculateShadow(fragPosLightSpace, N, L);

    // Primary direct lighting with shadow — retain 15% light in shadow for softer look
    vec3 Lo = (kD * albedo / PI + specular) * lightColor * NdotL * (1.0 - shadow * 0.85);

    // Secondary fill light (unshadowed)
    vec3 L2 = normalize(lightDir2);
    vec3 H2 = normalize(V + L2);
    float NDF2 = DistributionGGX(N, H2, roughness);
    float G2 = GeometrySmith(N, V, L2, roughness);
    vec3 F2 = fresnelSchlick(max(dot(H2, V), 0.0), F0);
    vec3 spec2 = (NDF2 * G2 * F2) / (4.0 * max(dot(N, V), 0.0) * max(dot(N, L2), 0.0) + 0.0001);
    vec3 kD2 = (vec3(1.0) - F2) * (1.0 - metallic);
    float NdotL2 = max(dot(N, L2), 0.0);
    Lo += (kD2 * albedo / PI + spec2) * lightColor2 * NdotL2;

    // Ambient/Environment lighting (not shadowed)
    float NdotV = max(dot(N, V), 0.0);
    vec3 F_env = fresnelSchlickRoughness(NdotV, F0, roughness);
    vec3 kS_env = F_env;
    vec3 kD_env = (1.0 - kS_env) * (1.0 - metallic);

    vec3 irradiance = getEnvironmentLight(N, 1.0);
    vec3 diffuseEnv = irradiance * albedo;

    vec3 R = reflect(-V, N);
    vec3 prefilteredColor = getEnvironmentLight(R, roughness);

    vec2 envBRDF = approximateBRDF(NdotV, roughness);
    vec3 specularEnv = prefilteredColor * (F_env * envBRDF.x + envBRDF.y);

    // Normal-based AO (bottom-facing slightly darker)
    float normalAO = 0.7 + 0.3 * clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
    float finalAO = ao * normalAO;

    vec3 ambientDiffuse = kD_env * diffuseEnv * 0.5;
    float specBoost = 1.0 + metallic * 2.0 * (1.0 - roughness);
    vec3 ambientSpecular = specularEnv * specBoost;
    vec3 ambient = (ambientDiffuse + ambientSpecular) * finalAO;

    // Rim/fresnel lighting for depth (stronger for metals)
    float rimPower = mix(3.0, 2.0, metallic);
    float rim = pow(1.0 - NdotV, rimPower) * mix(0.1, 0.25, metallic);
    vec3 rimColor = mix(skyColorTop, vec3(1.0), 0.5) * rim;

    vec3 color = ambient + Lo + rimColor;

    color *= exposure;

    // ACES Filmic tone mapping
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    color = clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);

    // Gamma correction
    color = pow(color, vec3(1.0 / 2.2));

    finalColor = vec4(color, 1.0);
}
)glsl";

// ============================================================================
// Ground Plane Shader
// Simple ground plane with gradient and soft edge fade
// ============================================================================

inline const char* kGroundPlane_VS = R"glsl(
#version 330

in vec3 vertexPosition;
in vec2 vertexTexCoord;

uniform mat4 mvp;
uniform mat4 matModel;
uniform mat4 lightSpaceMatrix;

out vec3 fragWorldPos;
out vec2 fragTexCoord;
out vec4 fragPosLightSpace;

void main() {
    vec4 worldPos = matModel * vec4(vertexPosition, 1.0);
    fragWorldPos = worldPos.xyz;
    fragTexCoord = vertexTexCoord;
    fragPosLightSpace = lightSpaceMatrix * worldPos;
    gl_Position = mvp * vec4(vertexPosition, 1.0);
}
)glsl";

inline const char* kGroundPlane_FS = R"glsl(
#version 330

in vec3 fragWorldPos;
in vec2 fragTexCoord;
in vec4 fragPosLightSpace;

out vec4 finalColor;

uniform vec3 groundColor;
uniform vec3 horizonColor;
uniform float fadeRadius;
uniform vec3 sceneCenter;
uniform vec3 lightDir;
uniform vec3 lightColor;
uniform vec3 cameraPos;
uniform sampler2D shadowMap;
uniform int shadowsActive;
uniform float gridSpacing;
uniform float cleanMode;   // 0.0 = normal textured ground, 1.0 = clean white-ish studio floor

float gridLine(vec2 worldPos, float spacing, float lineWidth) {
    vec2 grid = abs(fract(worldPos / spacing - 0.5) - 0.5) / fwidth(worldPos / spacing);
    return 1.0 - min(min(grid.x, grid.y), 1.0);
}

float unpackDepthGround(vec4 rgba) {
    return rgba.r + rgba.g / 255.0;
}

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i + vec2(0.0, 0.0));
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 4; i++) {
      v += a * valueNoise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
}

void main() {
    // Distance from scene center for fade
    float dist = length(fragWorldPos.xz - sceneCenter.xz);
    float fade = 1.0 - smoothstep(fadeRadius * 0.3, fadeRadius, dist);

    vec3 N = vec3(0.0, 1.0, 0.0);  // Ground normal (up)

    // Shadow calculation with Poisson disk soft sampling
    float shadow = 0.0;
    if (shadowsActive > 0) {
        vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
        projCoords = projCoords * 0.5 + 0.5;
        projCoords.y = 1.0 - projCoords.y;

        if (projCoords.z <= 1.0 &&
            projCoords.x >= 0.0 && projCoords.x <= 1.0 &&
            projCoords.y >= 0.0 && projCoords.y <= 1.0) {

            float currentDepth = projCoords.z;
            float bias = 0.002;

            const vec2 poissonDisk[16] = vec2[](
                vec2(-0.94201624, -0.39906216),
                vec2( 0.94558609, -0.76890725),
                vec2(-0.09418410, -0.92938870),
                vec2( 0.34495938,  0.29387760),
                vec2(-0.91588581,  0.45771432),
                vec2(-0.81544232, -0.87912464),
                vec2(-0.38277543,  0.27676845),
                vec2( 0.97484398,  0.75648379),
                vec2( 0.44323325, -0.97511554),
                vec2( 0.53742981, -0.47373420),
                vec2(-0.26496911, -0.41893023),
                vec2( 0.79197514,  0.19090188),
                vec2(-0.24188840,  0.99706507),
                vec2(-0.81409955,  0.91437590),
                vec2( 0.19984126,  0.78641367),
                vec2( 0.14383161, -0.14100790)
            );

            vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
            float spread = 2.5;
            for (int i = 0; i < 16; i++) {
                float pcfDepth = unpackDepthGround(texture(shadowMap, projCoords.xy + poissonDisk[i] * texelSize * spread));
                shadow += currentDepth - bias > pcfDepth ? 1.0 : 0.0;
            }
            shadow /= 16.0;
        }
    }

    // Diffuse lighting with shadow (reduced shadow in clean mode)
    float NdotL = max(dot(N, lightDir), 0.0);
    float shadowAmt = shadow * mix(1.0, 0.4, cleanMode);
    vec3 ambient = mix(vec3(0.50), vec3(0.97), cleanMode) * (1.0 - shadowAmt * mix(0.20, 0.08, cleanMode));
    vec3 diffuse = lightColor * NdotL * mix(0.50, 0.05, cleanMode) * (1.0 - shadowAmt * 0.75);
    vec3 lighting = ambient + diffuse;

    // Procedural texture variation (suppressed in clean mode)
    vec2 p = fragWorldPos.xz;
    float macroN = fbm(p * 0.09);
    float microN = fbm(p * 0.55 + vec2(19.7, -13.1));
    vec3 warmTint = groundColor * vec3(1.02, 1.00, 0.98);
    vec3 coolTint = groundColor * vec3(0.97, 0.98, 0.97);
    vec3 localGround = mix(coolTint, warmTint, smoothstep(0.3, 0.7, macroN));
    float variation = mix(1.0, mix(0.95, 1.05, microN), 1.0 - cleanMode * 0.8);
    localGround *= variation;

    // Blend toward horizon tint with distance
    vec3 baseColor = mix(localGround, horizonColor * 0.96, smoothstep(fadeRadius * 0.12, fadeRadius, dist) * 0.4);

    // Grazing highlight (reduced in clean mode)
    vec3 V = normalize(cameraPos - fragWorldPos);
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 color = baseColor * lighting + rim * vec3(0.045, 0.05, 0.04) * (1.0 - cleanMode * 0.7);

    // Grid overlay (hidden in clean mode)
    if (gridSpacing > 0.0 && cleanMode < 0.5) {
        float minorGrid = gridLine(fragWorldPos.xz, gridSpacing, 1.0);
        float majorGrid = gridLine(fragWorldPos.xz, gridSpacing * 5.0, 1.0);
        float gridFade = 1.0 - smoothstep(fadeRadius * 0.15, fadeRadius * 0.6, dist);
        float gridAlpha = max(minorGrid * 0.18, majorGrid * 0.4) * gridFade;
        color = mix(color, vec3(0.2), gridAlpha);
    }

    finalColor = vec4(color, fade);
}
)glsl";

// ============================================================================
// SSAO (Screen Space Ambient Occlusion) shader
// ============================================================================

// SSAO shader - samples depth around each pixel to compute occlusion
inline const char* kSSAOFS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;  // RGB=normal, A=linear depth (auto-bound by raylib)
uniform vec2 texelSize;
uniform float ssaoRadius;
uniform float ssaoIntensity;
uniform float zNear;
uniform float zFar;

float random(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec4 nd = texture(texture0, uv);
    float depth = nd.a;

    if (depth > 0.99) {
        finalColor = vec4(1.0);
        return;
    }

    vec3 normal = normalize(nd.rgb * 2.0 - 1.0);
    float linearDepth = depth * (zFar - zNear) + zNear;

    float sampleRadius = ssaoRadius * 50.0 * (linearDepth / 10.0);
    sampleRadius = clamp(sampleRadius, 10.0, 100.0);

    const int SAMPLES = 16;
    float occlusion = 0.0;
    float validSamples = 0.0;

    float rotAngle = random(uv * 1000.0) * 6.283185;

    for (int i = 0; i < SAMPLES; i++) {
        float angle = float(i) * 2.399963 + rotAngle;
        float r = (float(i) + 1.0) / float(SAMPLES);
        r = sqrt(r) * sampleRadius;

        vec2 offset = vec2(cos(angle), sin(angle)) * r * texelSize;
        vec4 neighborND = texture(texture0, uv + offset);
        float neighborDepth = neighborND.a;

        if (neighborDepth > 0.99) continue;

        vec3 neighborNormal = normalize(neighborND.rgb * 2.0 - 1.0);
        float normalDiff = 1.0 - max(0.0, dot(normal, neighborNormal));

        // Depth-based occlusion: neighbor closer to camera = occluding
        float depthDelta = depth - neighborDepth;
        float depthOcclusion = 0.0;
        if (depthDelta > 0.0005 && depthDelta < 0.05) {
            depthOcclusion = smoothstep(0.0005, 0.005, depthDelta);
        }

        // Normal-based occlusion at corners
        float normalOcclusion = smoothstep(0.2, 0.6, normalDiff);

        // Combine: either mechanism can trigger occlusion
        float occlusionContrib = max(depthOcclusion, normalOcclusion * 0.8);

        occlusion += occlusionContrib;
        validSamples += 1.0;
    }

    if (validSamples > 0.0) {
        occlusion = occlusion / validSamples;
    }

    float ao = 1.0 - occlusion * ssaoIntensity * 0.6;
    ao = clamp(ao, 0.0, 1.0);

    finalColor = vec4(ao, ao, ao, 1.0);
}
)glsl";

// SSAO blur shader - edge-preserving bilateral blur
inline const char* kSSAOBlurFS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;  // SSAO raw texture (auto-bound by raylib)
uniform sampler2D normalDepthTex;
uniform vec2 texelSize;

void main() {
    float centerAO = texture(texture0, uv).r;
    vec4 centerND = texture(normalDepthTex, uv);
    float centerDepth = centerND.a;
    vec3 centerNormal = centerND.rgb;

    if (centerDepth > 0.99) {
        finalColor = vec4(1.0);
        return;
    }

    float result = 0.0;
    float totalWeight = 0.0;
    const int BLUR_SIZE = 3;

    for (int x = -BLUR_SIZE; x <= BLUR_SIZE; x++) {
        for (int y = -BLUR_SIZE; y <= BLUR_SIZE; y++) {
            vec2 offset = vec2(float(x), float(y)) * texelSize;
            vec2 sampleUV = uv + offset;
            float sampleAO = texture(texture0, sampleUV).r;
            vec4 sampleND = texture(normalDepthTex, sampleUV);

            float depthDiff = abs(centerDepth - sampleND.a);
            float depthWeight = exp(-depthDiff * depthDiff * 10000.0);

            float normalDot = dot(centerNormal, sampleND.rgb);
            float normalWeight = max(0.0, normalDot);
            normalWeight = normalWeight * normalWeight;

            float spatialDist = length(vec2(float(x), float(y)));
            float spatialWeight = exp(-spatialDist * spatialDist * 0.08);

            float w = depthWeight * normalWeight * spatialWeight;
            result += sampleAO * w;
            totalWeight += w;
        }
    }

    result = totalWeight > 0.0 ? result / totalWeight : centerAO;
    finalColor = vec4(result, result, result, 1.0);
}
)glsl";

// ============================================================================
// Debug visualization shaders
// ============================================================================

// Debug shader to visualize depth buffer (uses same VS as edge shader)
// Note: texture0 is automatically bound by DrawTextureRec
inline const char* kDebugDepthFS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;  // Bound automatically by DrawTextureRec
uniform int debugMode;  // 0=depth, 1=normals, 2=normal+depth

void main() {
    vec4 nd = texture(texture0, uv);

    // Background has depth=1.0 (far), geometry has depth < 1.0
    bool isBackground = nd.a > 0.99;

    if (debugMode == 0) {
        // Depth visualization with logarithmic mapping
        // With zFar=1000, linear depth compresses to tiny range
        // Log scale spreads values more evenly across visual range
        float logScale = 50.0;  // Controls compression (higher = more spread for near)
        float logDepth = log(1.0 + nd.a * logScale) / log(1.0 + logScale);
        // Invert: near objects = bright, far = dark (more intuitive)
        float d = 1.0 - logDepth;
        finalColor = vec4(d, d, d, 1.0);
    } else if (debugMode == 1) {
        // Normals visualization - RGB encodes XYZ direction
        if (isBackground) {
            finalColor = vec4(0.3, 0.3, 0.4, 1.0);  // Gray for sky
        } else {
            finalColor = vec4(nd.rgb, 1.0);
        }
    } else {
        // Combined: normals with depth shading
        float logScale = 50.0;
        float logDepth = log(1.0 + nd.a * logScale) / log(1.0 + logScale);
        float d = 1.0 - logDepth;  // near=bright, far=dark
        if (isBackground) {
            finalColor = vec4(0.3, 0.3, 0.4, 1.0);
        } else {
            // Brighten normals based on proximity (near = full color, far = darker)
            finalColor = vec4(nd.rgb * (0.3 + d * 0.7), 1.0);
        }
    }
}
)glsl";

// ============================================================================
// FXAA (Fast Approximate Anti-Aliasing) shader
// Based on NVIDIA FXAA 3.11 by Timothy Lottes
// Smooths aliased edges based on luminance contrast detection
// ============================================================================

inline const char* kFXAA_FS = R"glsl(
#version 330
in vec2 uv;
out vec4 finalColor;

uniform sampler2D texture0;
uniform vec2 texelSize;
uniform float preserveAlpha;
uniform float skipVignette;

// FXAA settings
const float FXAA_REDUCE_MIN = 1.0/128.0;
const float FXAA_REDUCE_MUL = 1.0/8.0;
const float FXAA_SPAN_MAX = 8.0;

float luma(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
    // Sample center and 4 corners
    vec3 rgbNW = texture(texture0, uv + vec2(-1.0, -1.0) * texelSize).rgb;
    vec3 rgbNE = texture(texture0, uv + vec2( 1.0, -1.0) * texelSize).rgb;
    vec3 rgbSW = texture(texture0, uv + vec2(-1.0,  1.0) * texelSize).rgb;
    vec3 rgbSE = texture(texture0, uv + vec2( 1.0,  1.0) * texelSize).rgb;
    vec3 rgbM  = texture(texture0, uv).rgb;

    // Convert to luminance
    float lumaNW = luma(rgbNW);
    float lumaNE = luma(rgbNE);
    float lumaSW = luma(rgbSW);
    float lumaSE = luma(rgbSE);
    float lumaM  = luma(rgbM);

    // Find luminance range
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    // Compute edge direction
    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));

    // Scale direction by inverse of smallest component
    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = min(vec2(FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX), dir * rcpDirMin)) * texelSize;

    // Sample along the detected edge direction
    vec3 rgbA = 0.5 * (
        texture(texture0, uv + dir * (1.0/3.0 - 0.5)).rgb +
        texture(texture0, uv + dir * (2.0/3.0 - 0.5)).rgb);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture(texture0, uv + dir * -0.5).rgb +
        texture(texture0, uv + dir *  0.5).rgb);

    float lumaB = luma(rgbB);

    // Use rgbB if within range, otherwise rgbA (avoid artifacts)
    vec3 fxaaResult;
    if (lumaB < lumaMin || lumaB > lumaMax) {
        fxaaResult = rgbA;
    } else {
        fxaaResult = rgbB;
    }

    if (preserveAlpha > 0.5) {
        float srcAlpha = texture(texture0, uv).a;
        finalColor = vec4(fxaaResult, srcAlpha);
    } else if (skipVignette > 0.5) {
        finalColor = vec4(fxaaResult, 1.0);
    } else {
        vec2 vignetteUV = uv * 2.0 - 1.0;
        float vignette = 1.0 - dot(vignetteUV, vignetteUV) * 0.15;
        vignette = clamp(vignette, 0.0, 1.0);
        vignette = mix(0.85, 1.0, vignette);
        finalColor = vec4(fxaaResult * vignette, 1.0);
    }
}
)glsl";

}  // namespace shaders
