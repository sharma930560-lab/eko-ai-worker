@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr
set ANDROID_HOME=C:\Users\naman\AppData\Local\Android\Sdk
set HOME=C:\Users\naman
set USERPROFILE=C:\Users\naman
set GRADLE_USER_HOME=C:\Users\naman\.gradle
set ANDROID_USER_HOME=C:\Users\naman\.android
set ANDROID_PREFS_ROOT=
set JAVA_EXE=%JAVA_HOME%\bin\java.exe
set DIRNAME=%~dp0
if "%DIRNAME%" == "" set DIRNAME=.
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%
set CLASSPATH=%APP_HOME%gradle\wrapper\gradle-wrapper.jar
"%JAVA_EXE%" -Xmx64m -Xms64m "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
