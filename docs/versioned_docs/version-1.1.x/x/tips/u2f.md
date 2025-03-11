---
sidebar_position: 1
---

# U2F Security Keys

If you use a U2F physical security key (like a Yubikey) to protect your X account, good for you! Security keys provide the best security to protect your online accounts.

However, there is a known bug related to logging into your X account within Cyd's embedded browser with a security key. Here's how to work around it:

- Plug in your U2F security key
- Add a new X account to Cyd
- Enter your username and click **Next**
- Enter your password and click **Log in**
- When the embedded browser shows a white screen, press the button on your security key to login
- The sign in process will finish successfully

For some reason, when X is waiting for you to press the button on your security key it displays a blank white page. And due to an [upstream bug](https://github.com/electron/electron/issues/24573) in Electron, the framework that Cyd uses, Cyd isn't able to instruct you to press the button on your security key.

Hopefully this will be fixed in a future version, but for now you can rely on this simple workaround.