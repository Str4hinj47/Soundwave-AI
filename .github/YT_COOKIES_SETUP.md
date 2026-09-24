# Add YT_COOKIES so the Actions relay can download Orbital NCG

YouTube bot-walls datacenter IPs (GitHub-hosted runners). The fetch workflow
(`.github/workflows/fetch-orbital.yml`) already supports a Netscape `cookies.txt`
via the Actions secret **YT_COOKIES**.

## 1. Export cookies from your browser

1. Sign in to YouTube in Chrome/Firefox on your machine.
2. Install an extension such as **Get cookies.txt LOCALLY** (Chrome) or
   **cookies.txt** (Firefox).
3. Open `https://www.youtube.com/` while logged in and export **cookies.txt**
   (Netscape format).

Use a spare/throwaway Google account if possible — automated use from a runner
can flag a personal account.

## 2. Create the repo secret

1. Open https://github.com/Str4hinj47/Soundwave-AI/settings/secrets/actions
2. **New repository secret**
3. Name: `YT_COOKIES`
4. Value: paste the **entire** contents of the exported `cookies.txt`
   (starts with `# Netscape HTTP Cookie File`).
5. Save.

## 3. Trigger a fetch

Push a change to `.github/fetch-orbital.trigger` on `main` (line 1 = video id),
or wait for the next scheduled/manual run. The job log will show:

- `using YT_COOKIES secret` — hooks are active
- `no YT_COOKIES secret` — secret missing/empty

Committed MP4s land in
`background_cache/minecraft_parkour/downloads/orbital_<id>.mp4` on `main`.

## Local app (no Actions)

Set `YTDLP_COOKIES=/path/to/cookies.txt` in the server environment for the same
cookie file. The download path already passes `--js-runtimes node --js-runtimes deno`
and `player_client=tv,web_safari`.
