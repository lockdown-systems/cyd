---
sidebar_position: 1
---

# Download Cyd

Cyd is desktop app available for Windows, Mac, and Linux.

:::info
There are currently no plans to make a mobile verson of Cyd for Android or iPhone. Cyd works by controlling a web browser on your device, sometimes for several hours at a time without sleep, and this is notoriously hard to do on mobile operating systems.
:::

## Cyd for Windows and Mac

If you're using Windows or Mac, download Cyd from the main website:

<a class="button button--primary button--lg" href="https://cyd.social/download/">Download Cyd</a>

## Cyd for Linux

Are you a Linux user? You're in luck! Cyd is 100% nerd compatible.

There are Debian and RPM-based repositories for Cyd. And if that doesn't work for you, you can download a ZIP file (and its PGP signature) which will run on any distro.

### Debian-based Distros

Follow these instructions to add the Lockdown Systems repository and install Cyd on Debian-based distros, like Debian or Ubuntu.

```sh
# Import the signing key
curl -fsSL https://releases.lockdown.systems/signing-key.asc | sudo gpg --dearmor -o /usr/share/keyrings/lockdown-systems-archive-keyring.gpg

# Add the repository
echo "deb [signed-by=/usr/share/keyrings/lockdown-systems-archive-keyring.gpg] https://releases.lockdown.systems/debian/ prod main" | sudo tee /etc/apt/sources.list.d/lockdown-systems.list

# Install Cyd
sudo apt update
sudo apt install cyd
```

### RPM-based Distros

Follow these instructions to add the Lockdown Systems repository and install Cyd on RPM-based distros, like Fedora or CentOS.

```sh
# Import the signing key
sudo rpm --import https://releases.lockdown.systems/signing-key.asc

# Add the repository
sudo tee /etc/yum.repos.d/lockdown-systems.repo <<EOF
[lockdown-systems]
name=Lockdown Systems Repository
baseurl=https://releases.lockdown.systems/rpm/prod/
enabled=1
gpgcheck=1
gpgkey=https://releases.lockdown.systems/signing-key.asc
EOF

# Install Cyd
sudo dnf install cyd
```

### ZIP files

You can also download ZIP files of Cyd binaries to run it on any Linux distro, regardless of the package manager. If you'd like to verify the signatures, they are signed with [this PGP key](https://releases.lockdown.systems/signing-key.asc). The fingerprint is `F053C5B7620B1825110DF1ABBB52A6E048DF2452`.

- [Cyd in ZIP format (x64)](https://api.cyd.social/download?platform=linux) – [PGP signature](https://api.cyd.social/download?platform=linux&sig=true)
- [Cyd in ZIP format (arm64)](https://api.cyd.social/download?platform=linux&arch=arm64) – [PGP signature](https://api.cyd.social/download?platform=linux&arch=arm64&sig=true)
