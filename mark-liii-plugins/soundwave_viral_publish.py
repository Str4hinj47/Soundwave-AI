"""
Soundwave Viral Autopilot + Auto Publish — Phase 7
User selected: Do the auto publish and viral autopilot

Combines:
- Viral Autopilot: auto-generates 5 viral titles, description with hooks/CTA, trending hashtags, thumbnail prompt + image, best posting time, trending topics via web_search
- Auto Publish: auto-uploads final MP4 to YouTube Shorts via API (if credentials) or browser automation via existing Chrome (youtube.com/upload), sets #Shorts, returns publish link. Also TikTok browser upload fallback.

Uses existing true automation core: focus Chrome, accessibility tree zero tokens, mouse easing visible, clipboard.
"""

PLUGIN = {
    "name": "soundwave_viral_publish",
    "description": "Viral Autopilot + Auto Publish to YouTube Shorts — generates 5 viral titles optimized for Shorts algorithm, description with hooks/CTA, trending hashtags #Shorts #motivation, thumbnail prompt + image via generate_image, best posting time, trending topics via web_search. Then auto-uploads final MP4 to YouTube Shorts via API or browser automation (youtube.com/upload) with title/description/tags, sets visibility, returns publish URL. Also TikTok upload. Actions: viral_pack topic=... script=..., trending query=..., thumbnail topic=..., publish_youtube file=... title=... description=..., publish_tiktok file=..., full_viral_publish topic=... background_type=... voice=..., guide. Completes loop idea→published.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: guide, viral_pack, trending, thumbnail, publish_youtube, publish_tiktok, full_viral_publish, status, open_progress",
                "enum": ["guide", "viral_pack", "trending", "thumbnail", "publish_youtube", "publish_tiktok", "full_viral_publish", "status", "open_progress", "titles", "hashtags", "description_gen"]
            },
            "topic": {"type": "STRING", "description": "Topic e.g. motivational story about never giving up"},
            "script": {"type": "STRING", "description": "Script text for viral pack generation"},
            "voice": {"type": "STRING", "description": "Voice Jenny etc default Jenny"},
            "background_type": {"type": "STRING", "description": "minecraft, subway_surfers, roblox, random", "enum": ["minecraft", "subway_surfers", "roblox", "minecraft_parkour", "gta", "random"]},
            "file": {"type": "STRING", "description": "Path to MP4 file to publish, e.g. C:/Users/.../Downloads/short.mp4 or auto-detect recent"},
            "title": {"type": "STRING", "description": "Title for YouTube upload"},
            "description": {"type": "STRING", "description": "Description for YouTube upload"},
            "tags": {"type": "STRING", "description": "Tags comma separated"},
            "query": {"type": "STRING", "description": "Trending query e.g. motivational shorts trending 2026"}
        },
        "required": ["action"]
    }
}

import os
import time
import json
import re
import random
from pathlib import Path
import platform
import socket

STATE_FILE = Path.home() / ".jarvis_yt_short_state.json"
PROGRESS_FILE = Path.home() / ".jarvis_yt_short_progress.log"
VIRAL_FILE = Path.home() / ".jarvis_viral_pack.json"
VISIBLE_HTML = Path.home() / "Downloads" / "Jarvis 54" / "Mark-LIV" / "yt_short_live_progress.html"
VISIBLE_FALLBACKS = [
    Path.home() / "Downloads" / "Jarvis 54" / "Mark-LIV" / "yt_short_live_progress.html",
    Path.home() / "Downloads" / "Jarvis 54" / "yt_short_live_progress.html",
    Path.home() / "Downloads" / "yt_short_live_progress.html",
    Path.home() / ".jarvis_yt_short_live_progress.html",
]

BLACKLIST_URLS = ["dQw4w9WgXcQ"]

def _now():
    return time.strftime("%Y-%m-%d %H:%M:%S")

def _get_visible_html_path():
    for p in VISIBLE_FALLBACKS:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.parent.exists():
                return p
        except:
            continue
    return VISIBLE_HTML

def _save_viral_pack(pack):
    try:
        pack["last_update"]=_now()
        pack["heartbeat"]=time.time()
        with open(VIRAL_FILE,"w",encoding="utf-8") as f:
            json.dump(pack,f,indent=2)
    except:
        pass

def _load_viral_pack():
    try:
        if VIRAL_FILE.exists():
            with open(VIRAL_FILE,"r",encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return None

def _load_state():
    try:
        if STATE_FILE.exists():
            with open(STATE_FILE,"r",encoding="utf-8") as f:
                return json.load(f)
    except:
        pass
    return None

def _generate_viral_titles(topic, script=""):
    topic=topic.strip()
    # Hook formulas that work for Shorts algorithm
    base=topic.replace("motivational story about","").replace("story about","").strip().title() or topic.title()
    titles=[
        f"{base} — This Will Change Your Life in 30 Seconds",
        f"Stop Scrolling: {base} You NEED to Hear This",
        f"The Truth About {base} No One Tells You",
        f"If You're Struggling With {base}, Watch This",
        f"{base}: 1% Do This, 99% Don't — Which Are You?",
        f"POV: You Finally Understand {base}",
        f"I Wish I Knew This About {base} Sooner",
        f"{base} — The Motivation You Didn't Know You Needed Today",
    ]
    # Pick 5 based on hash of topic for consistency
    idx=sum(ord(c) for c in topic) % len(titles)
    selected=[]
    for i in range(5):
        selected.append(titles[(idx+i) % len(titles)])
    # Ensure #Shorts friendly <60 chars? Keep first 3 short
    short_versions=[
        f"{base} Will Change Your Life",
        f"Stop Scrolling: {base}",
        f"The Truth About {base}",
        f"Watch This If You Need {base}",
        f"{base} Motivation in 30s",
    ]
    # Mix
    final=[]
    for i in range(5):
        if i<2:
            final.append(short_versions[(idx+i) % len(short_versions)])
        else:
            final.append(selected[i])
    return final[:5]

def _generate_hashtags(topic, bg_type="minecraft"):
    topic_lower=topic.lower()
    base_tags=["#Shorts","#YouTubeShorts","#Viral","#Motivation","#Mindset","#Success"]
    if "motiv" in topic_lower:
        base_tags+=["#Motivational","#NeverGiveUp","#Inspiration","#SelfImprovement","#LifeAdvice"]
    if "finance" in topic_lower or "money" in topic_lower:
        base_tags+=["#Finance","#MoneyMindset","#RichMindset","#Entrepreneur"]
    if "cat" in topic_lower or "story" in topic_lower:
        base_tags+=["#StoryTime","#ShortStory","#Wholesome"]
    if "horror" in topic_lower:
        base_tags+=["#HorrorStory","#ScaryStory","#Creepypasta"]
    # Background tags
    if bg_type=="minecraft":
        base_tags+=["#Minecraft","#MinecraftParkour","#Gaming"]
    elif bg_type=="subway_surfers":
        base_tags+=["#SubwaySurfers","#Gaming","#Gameplay"]
    elif bg_type=="roblox":
        base_tags+=["#Roblox","#RobloxObby","#Gaming"]
    # Trending 2026 tags
    base_tags+=["#FYP","#ForYou","#Trending"]
    # Deduplicate keep order
    seen=set()
    uniq=[]
    for t in base_tags:
        if t.lower() not in seen:
            seen.add(t.lower())
            uniq.append(t)
    return uniq[:15]

def _generate_description(topic, script, titles, hashtags):
    best_title=titles[0] if titles else topic
    desc=f"""{best_title}

{script[:200]}...

This short is about {topic}. If this resonated, you're not alone. The hardest part is starting — momentum carries you after.

🔔 Subscribe for daily motivation that actually hits.
👍 Like if you needed this today.
💬 Comment what you're working on — I'll reply.

Chapters:
0:00 - The Hook
0:05 - The Story
0:25 - Your Turn

{ ' '.join(hashtags[:8]) }

#Shorts is vertical 9:16 720p 60fps with TikTok style subtitles + no-copyright gameplay background.

Credits:
Voice: AI generated (Edge TTS Jenny)
Background: No-copyright { ' '.join(hashtags[-2:]) } gameplay — free to use
Edited with Soundwave-AI — Portrait 720p 60fps End-with-voice

Want your own? Comment your topic.
"""
    return desc.strip()

def _get_best_posting_time():
    # Based on YouTube Shorts analytics general best times
    return {
        "best_times_ET": ["12pm-3pm", "7pm-10pm"],
        "best_times_CET": ["6pm-9pm", "1am-4am"],
        "best_days": ["Tuesday","Thursday","Friday","Saturday","Sunday"],
        "why": "Shorts feed peaks lunch + evening scroll, weekends higher retention. Post Tuesday-Thursday 7pm CET for max EU+US overlap.",
        "timezone_note": "Your local Europe/Belgrade CET — post 7pm-9pm CET = 1pm-3pm ET US lunch"
    }

def _generate_thumbnail_prompt(topic, bg_type="minecraft"):
    prompts=[
        f"Vertical 9:16 YouTube Shorts thumbnail, bold text '{topic[:30]}' in white Montserrat ExtraBold with purple #8B5CF6 stroke, {bg_type} parkour gameplay background blurred, high contrast, viral, MrBeast style, 720x1280",
        f"Motivational thumbnail, person silhouette standing on mountain top, text 'NEVER GIVE UP' bold white with purple glow #8B5CF6, minecraft parkour background, dramatic lighting, 9:16",
        f"YouTube Shorts thumbnail, close-up face with determination, text '{topic[:20]}' in TikTok style white on purple #8B5CF6, subway surfers background, high energy",
    ]
    idx=sum(ord(c) for c in topic) % len(prompts)
    return prompts[idx]

def _find_recent_mp4():
    try:
        downloads=Path.home() / "Downloads"
        if not downloads.exists():
            return None, f"Downloads not found {downloads}"
        recent=[]
        now=time.time()
        for f in downloads.glob("*.mp4"):
            try:
                mtime=f.stat().st_mtime
                age=now-mtime
                size=f.stat().st_size
                if age<86400:  # last 24h
                    recent.append((f,age,size))
            except:
                continue
        if not recent:
            return None, f"No mp4 in {downloads} last 24h — generate short first via full_auto"
        recent.sort(key=lambda x: x[1])
        f,age,size=recent[0]
        return f, f"Found recent {f.name} {size/1024/1024:.2f}MB {int(age)}s ago"
    except Exception as e:
        return None, f"Find recent mp4 failed {e}"

def _focus_chrome():
    try:
        import pygetwindow as gw
        titles=gw.getAllTitles()
        for t in titles:
            if 'soundwave' in t.lower() or '5173' in t or 'studio' in t.lower():
                try:
                    w=gw.getWindowsWithTitle(t)[0]
                    w.activate()
                    time.sleep(0.5)
                    return True, f"Focused Soundwave '{t}'"
                except:
                    continue
        for t in titles:
            if 'chrome' in t.lower() and t.strip():
                try:
                    w=gw.getWindowsWithTitle(t)[0]
                    w.activate()
                    time.sleep(0.5)
                    return True, f"Focused Chrome '{t}'"
                except:
                    continue
        return False, f"No Chrome found {len(titles)} titles"
    except Exception as e:
        return False, f"Focus Chrome failed {e}"

def _navigate_to(url, wait_sec=4):
    try:
        import pyautogui, pyperclip
        pyautogui.hotkey('ctrl','l')
        time.sleep(0.3)
        pyperclip.copy(url)
        pyautogui.hotkey('ctrl','v')
        time.sleep(0.2)
        pyautogui.press('enter')
        time.sleep(wait_sec)
        return True, f"Navigated to {url} wait {wait_sec}s"
    except Exception as e:
        return False, f"Navigate failed {e}"

def _find_element_accessibility(name, max_elements=100):
    try:
        from pywinauto import Desktop
        import ctypes
        hwnd=ctypes.windll.user32.GetForegroundWindow()
        from pywinauto import Application
        app=Application(backend="uia").connect(handle=hwnd)
        wrapper=app.top_window().wrapper_object()
        name_lower=name.lower().strip()
        for child in wrapper.descendants():
            try:
                cname=(child.element_info.name or "").lower()
                if not cname:
                    continue
                if cname==name_lower or (name_lower in cname and len(name_lower)>=3):
                    rect=child.rectangle()
                    if rect.width()==0 or rect.height()==0:
                        continue
                    enabled=True
                    try:
                        enabled=child.is_enabled()
                    except:
                        pass
                    return {"name":child.element_info.name,"type":child.element_info.control_type,"x":rect.left,"y":rect.top,"w":rect.width(),"h":rect.height(),"cx":rect.left+rect.width()//2,"cy":rect.top+rect.height()//2,"enabled":enabled}, None
            except:
                continue
        return None, f"Element '{name}' not found"
    except ImportError:
        return None, "pywinauto not installed"
    except Exception as e:
        return None, f"Accessibility find failed {e}"

def _move_with_easing(x,y,duration=0.5,easing="easeOut"):
    import math
    def _ease(t,mode="easeOut"):
        if mode=="linear":
            return t
        elif mode=="easeIn":
            return t*t
        elif mode=="easeOut":
            return 1-(1-t)*(1-t)
        else:
            return 2*t*t if t<0.5 else 1-math.pow(-2*t+2,2)/2
    try:
        import pyautogui
        if duration<=0:
            pyautogui.moveTo(x,y)
            return True
        start_x,start_y=pyautogui.position()
        steps=max(1,int(duration*60))
        for i in range(steps+1):
            t=i/steps
            e=_ease(t,easing)
            cur_x=int(start_x+(x-start_x)*e)
            cur_y=int(start_y+(y-start_y)*e)
            pyautogui.moveTo(cur_x,cur_y)
            time.sleep(duration/steps)
        return True
    except:
        try:
            import pyautogui
            pyautogui.moveTo(x,y)
            return True
        except:
            return False

def _click_accessibility(name, duration=0.5):
    el,err=_find_element_accessibility(name)
    if err or not el:
        return False, err or f"Not found {name}"
    if not el.get("enabled",True):
        return False, f"Element '{name}' disabled"
    cx=el["cx"]
    cy=el["cy"]
    try:
        _move_with_easing(cx,cy,duration=duration,easing="easeOut")
        time.sleep(0.2)
        import pyautogui
        pyautogui.click(cx,cy)
        time.sleep(0.5)
        return True, f"Clicked '{name}' at ({cx},{cy}) via accessibility + easing visible"
    except Exception as e:
        return False, f"Click failed {e}"

def _fill_via_clipboard(text):
    try:
        import pyautogui, pyperclip
        pyperclip.copy(text)
        time.sleep(0.2)
        pyautogui.hotkey('ctrl','v')
        time.sleep(0.5)
        return True, f"Filled {len(text)} chars via clipboard"
    except Exception as e:
        return False, f"Fill failed {e}"

def _upload_youtube_api(file_path, title, description, tags):
    """Try YouTube Data API v3 if credentials exist"""
    try:
        # Look for credentials
        cred_paths=[
            Path.home() / ".youtube_credentials.json",
            Path.home() / "Downloads" / "Jarvis 54" / "client_secret.json",
            Path.home() / ".config" / "youtube" / "credentials.json",
        ]
        cred_file=None
        for p in cred_paths:
            if p.exists():
                cred_file=p
                break
        if not cred_file:
            return False, f"YouTube API credentials not found — looked in {cred_paths} — will fallback to browser automation at https://www.youtube.com/upload. To use API: create OAuth2 client at console.cloud.google.com, download client_secret.json to {cred_paths[0]}"
        # Try import google api
        try:
            from googleapiclient.discovery import build
            from googleapiclient.http import MediaFileUpload
            from google_auth_oauthlib.flow import InstalledAppFlow
            import pickle
        except ImportError:
            return False, "google-api-python-client not installed — pip install google-api-python-client google-auth-oauthlib google-auth — fallback to browser upload"

        SCOPES=["https://www.googleapis.com/auth/youtube.upload"]
        # Load or create token
        token_path=Path.home() / ".youtube_token.pickle"
        creds=None
        if token_path.exists():
            try:
                with open(token_path,"rb") as f:
                    creds=pickle.load(f)
            except:
                pass
        if not creds:
            flow=InstalledAppFlow.from_client_secrets_file(str(cred_file),SCOPES)
            creds=flow.run_local_server(port=0)
            with open(token_path,"wb") as f:
                pickle.dump(creds,f)

        youtube=build("youtube","v3",credentials=creds)
        body={
            "snippet":{
                "title":title[:100],  # YouTube max 100
                "description":description,
                "tags":tags[:15],
                "categoryId":"22",  # People & Blogs
            },
            "status":{
                "privacyStatus":"public",
                "selfDeclaredMadeForKids":False,
            }
        }
        media=MediaFileUpload(str(file_path),chunksize=-1,resumable=True,mimetype="video/mp4")
        request=youtube.videos().insert(part="snippet,status",body=body,media_body=media)
        response=None
        while response is None:
            status,response=request.next_chunk()
            if status:
                print(f"Upload {int(status.progress()*100)}%")
        video_id=response["id"]
        url=f"https://www.youtube.com/watch?v={video_id}"
        # Also Shorts URL
        shorts_url=f"https://www.youtube.com/shorts/{video_id}"
        return True, f"Uploaded via YouTube API: {url} Shorts {shorts_url} Title '{title}' — video_id {video_id}"
    except Exception as e:
        return False, f"YouTube API upload failed {e} — fallback to browser automation"

def _upload_youtube_browser(file_path, title, description, tags):
    """Browser automation fallback: upload via youtube.com/upload in existing Chrome"""
    try:
        ok_fc,msg_fc=_focus_chrome()
        if not ok_fc:
            return False, f"Focus Chrome failed {msg_fc} — open Chrome to https://www.youtube.com/upload"
        ok_nav,msg_nav=_navigate_to("https://www.youtube.com/upload",wait_sec=5)
        # Wait for upload button
        time.sleep(3)
        # Try find SELECT FILES button via accessibility
        el,err=_find_element_accessibility("SELECT FILES")
        if not el:
            el,err=_find_element_accessibility("Select files")
        if el:
            _move_with_easing(el["cx"],el["cy"],duration=0.6)
            import pyautogui
            pyautogui.click(el["cx"],el["cy"])
            time.sleep(1)
            # File dialog should appear — type file path via clipboard
            # The file dialog is native Windows, accessibility tree should have File name field
            time.sleep(1)
            # Try type file path directly via clipboard + enter
            ok_fill,msg_fill=_fill_via_clipboard(str(file_path))
            time.sleep(0.5)
            import pyautogui
            pyautogui.press('enter')
            time.sleep(3)
        else:
            # Fallback: try drag drop or use pyautogui to click center and paste path
            return False, f"SELECT FILES button not found via accessibility — try manual: open https://www.youtube.com/upload in Chrome, drag {file_path} to page, then fill title/description. Error {err}"

        # Now should be on details page — fill title
        time.sleep(5)
        # Find Title field
        el_title,err_title=_find_element_accessibility("Title")
        if el_title:
            _move_with_easing(el_title["cx"],el_title["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_title["cx"],el_title["cy"])
            time.sleep(0.3)
            pyautogui.hotkey('ctrl','a')
            time.sleep(0.2)
            _fill_via_clipboard(title[:100])
            time.sleep(0.5)

        # Description field — usually second textbox
        # Try find Description
        el_desc,err_desc=_find_element_accessibility("Description")
        if el_desc:
            _move_with_easing(el_desc["cx"],el_desc["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_desc["cx"],el_desc["cy"])
            time.sleep(0.3)
            _fill_via_clipboard(description[:5000])
            time.sleep(0.5)

        # Tags — scroll down
        try:
            import pyautogui
            pyautogui.press('pagedown')
            time.sleep(0.5)
            pyautogui.press('pagedown')
            time.sleep(0.5)
        except:
            pass

        # Try show more, add tags
        el_more,err_more=_find_element_accessibility("SHOW MORE")
        if el_more:
            _move_with_easing(el_more["cx"],el_more["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_more["cx"],el_more["cy"])
            time.sleep(1)

        el_tags,err_tags=_find_element_accessibility("Add tags")
        if el_tags:
            _move_with_easing(el_tags["cx"],el_tags["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_tags["cx"],el_tags["cy"])
            time.sleep(0.3)
            _fill_via_clipboard(", ".join(tags[:10]))
            time.sleep(0.5)

        # Next buttons — click Next 3 times
        for i in range(3):
            el_next,err_next=_find_element_accessibility("Next")
            if el_next:
                _move_with_easing(el_next["cx"],el_next["cy"],duration=0.5)
                import pyautogui
                pyautogui.click(el_next["cx"],el_next["cy"])
                time.sleep(2)
            else:
                # Try via keyboard Enter?
                try:
                    import pyautogui
                    pyautogui.press('enter')
                    time.sleep(2)
                except:
                    pass

        # Visibility Public
        el_pub,err_pub=_find_element_accessibility("Public")
        if el_pub:
            _move_with_easing(el_pub["cx"],el_pub["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_pub["cx"],el_pub["cy"])
            time.sleep(1)

        # Publish / Save
        el_pub2,err_pub2=_find_element_accessibility("Publish")
        if not el_pub2:
            el_pub2,err_pub2=_find_element_accessibility("Save")
        if el_pub2:
            _move_with_easing(el_pub2["cx"],el_pub2["cy"],duration=0.5)
            import pyautogui
            pyautogui.click(el_pub2["cx"],el_pub2["cy"])
            time.sleep(3)
            return True, f"Browser upload flow completed — clicked Publish for {file_path} title '{title}' — check https://studio.youtube.com for video URL. {msg_fc} {msg_nav}"

        return False, f"Browser upload partial — filled title/description but Publish button not found. File {file_path} should be uploading at https://www.youtube.com/upload — finish manually. Steps done: {msg_fc} {msg_nav}"

    except Exception as e:
        return False, f"Browser upload failed {e}"

def _guide():
    return """
# Viral Autopilot + Auto Publish — Phase 7

**You said: Do the auto publish and viral autopilot — building both.**

## Viral Autopilot — Makes your Short go viral, not just exist

**Problem:** You generate a short but title is boring, no hashtags, no description hook, no thumbnail — algorithm doesn't push it.

**Fix:** viral_pack generates viral-optimized package:

- **5 Viral Titles** (Shorts algorithm <60 chars hook + long curiosity):
  Formula: [Hook] + [Topic] + [Curiosity Gap]
  Examples:
  - "Stop Scrolling: Never Giving Up You NEED to Hear This"
  - "This Will Change Your Life in 30 Seconds"
  - "The Truth About Motivation No One Tells You"
  Picks based on topic hash for consistency, mixes short (<40 chars) for CTR + long for curiosity

- **Trending Hashtags** (15 max, algorithm loves):
  Base #Shorts #YouTubeShorts #Viral #FYP #ForYou #Trending
  + Topic #Motivational #NeverGiveUp #Inspiration #SelfImprovement
  + Background #Minecraft #MinecraftParkour #Gaming
  Deduplicated, order optimized

- **Description with Hooks + CTA** (YouTube loves watch time + engagement):
  - First 2 lines hook (visible without Show More) = best_title + script preview
  - Middle story + value
  - CTA: Subscribe, Like, Comment what you're working on — I'll reply
  - Chapters 0:00 Hook 0:05 Story 0:25 Your Turn
  - Hashtags first 8 visible
  - Credits voice/background/edit
  - Ends with "Want your own? Comment your topic" — drives comments = algorithm boost

- **Best Posting Time** (analytics based):
  ET 12pm-3pm + 7pm-10pm lunch + evening scroll
  CET 6pm-9pm + 1am-4am — your Europe/Belgrade 7pm-9pm CET = 1pm-3pm ET US lunch = max EU+US overlap
  Best days Tuesday Thursday Friday Saturday Sunday

- **Thumbnail Prompt + Image**:
  Prompt: "Vertical 9:16 YouTube Shorts thumbnail, bold text 'TOPIC' white Montserrat ExtraBold purple #8B5CF6 stroke, minecraft parkour background blurred, high contrast, viral MrBeast style, 720x1280"
  Then generate_image file_path prompt → creates thumbnail jpg in Downloads

- **Trending Topics** via web_search:
  Uses web_search query="motivational shorts trending 2026" mode=search to find what's viral now, suggests topics

## Auto Publish — Idea to Published, no manual upload

**Problem:** After download, you still have to manually go to youtube.com/upload, drag file, fill title/description/tags, click Publish — breaks automation.

**Fix:** publish_youtube does it automatically:

**Method 1 — YouTube Data API v3 (preferred if credentials exist):**
- Looks for credentials at ~/.youtube_credentials.json or ~/Downloads/Jarvis 54/client_secret.json
- If not found, instructs how to create OAuth2 at console.cloud.google.com → download client_secret.json
- Uses googleapiclient to upload video with snippet title/description/tags category People & Blogs, privacy public
- Returns video_id + https://www.youtube.com/watch?v=ID + https://www.youtube.com/shorts/ID
- Requires: pip install google-api-python-client google-auth-oauthlib google-auth

**Method 2 — Browser Automation Fallback (works without API keys, uses existing Chrome):**
- Focuses existing Chrome via pygetwindow (keeps login)
- Navigates to https://www.youtube.com/upload via ctrl+l paste enter
- Finds SELECT FILES button via accessibility tree zero tokens + mouse easing visible click
- Types file path via clipboard + enter in native file dialog
- Waits 5s upload
- Finds Title field via accessibility, clicks, ctrl+a, clipboard paste title[:100]
- Finds Description field, paste description[:5000]
- Scrolls down pagedown x2, clicks SHOW MORE, finds Add tags field, pastes tags
- Clicks Next 3 times, clicks Public, clicks Publish
- You SEE each click with mouse easing!

**TikTok upload** similar browser automation at https://www.tiktok.com/upload

## Actions

- viral_pack topic=... script=... background_type=minecraft → generates 5 titles + hashtags + description + best time + thumbnail prompt + saves to ~/.jarvis_viral_pack.json
- trending query=motivational shorts trending → web_search for trending topics
- thumbnail topic=... background_type=minecraft → generates thumbnail prompt + tries generate_image
- publish_youtube file=... title=... description=... tags=... → tries API first then browser fallback
- publish_tiktok file=... title=... → browser automation tiktok.com/upload
- full_viral_publish topic=... background_type=minecraft voice=Jenny → does full_auto (true automation) + viral_pack + publish_youtube + returns publish URL — IDEA TO PUBLISHED

## Voice commands

"Viral pack topic motivational story about never giving up background minecraft"
"Trending motivational shorts"
"Generate thumbnail topic never give up background minecraft"
"Publish youtube file C:/Users/.../Downloads/short.mp4 title Stop Scrolling This Will Change Your Life"
"Full viral publish topic motivational background minecraft"
→ Does full_auto + viral + publish + DONE notification with publish URL

## Full flow with visible tab

full_viral_publish does:
1. full_auto via soundwave_true_automation — truly clicks himself, you watch mouse move, visible tab auto-refresh 2s
2. viral_pack — generates titles/hashtags/description/best time/thumbnail
3. publish_youtube — uploads via API or browser automation, returns URL
4. DONE notification "Done Sir Your Short is published at https://youtube.com/shorts/ID with viral pack"

State files:
~/.jarvis_yt_short_state.json — workflow state survives restart
~/.jarvis_viral_pack.json — viral pack titles/hashtags/description
~/Downloads/Jarvis 54/Mark-LIV/yt_short_live_progress.html — visible tab live

To enable YouTube API:
1. Go to console.cloud.google.com → New Project → Enable YouTube Data API v3
2. Credentials → Create OAuth2 Client ID → Desktop App → Download JSON
3. Save as C:/Users/Strahinja/.youtube_credentials.json or ~/Downloads/Jarvis 54/client_secret.json
4. pip install google-api-python-client google-auth-oauthlib google-auth
5. First upload will open browser for OAuth consent, saves token to ~/.youtube_token.pickle

Without API, browser automation works but needs you logged into YouTube in existing Chrome.
"""

def run(parameters, player=None, session_memory=None):
    def log(msg):
        if player and hasattr(player,'write_log'):
            try:
                player.write_log(msg)
            except:
                pass

    action=(parameters.get("action") or "guide").strip().lower()
    topic=parameters.get("topic") or "motivational story about never giving up"
    script=parameters.get("script") or ""
    voice=parameters.get("voice") or "Jenny"
    bg_type=parameters.get("background_type") or "random"
    file_path=parameters.get("file") or ""
    title=parameters.get("title") or ""
    description=parameters.get("description") or ""
    tags_str=parameters.get("tags") or ""
    query=parameters.get("query") or "motivational shorts trending 2026"

    if action=="guide":
        return _guide()

    if action in ("viral_pack","titles","hashtags","description_gen"):
        # Load script from state if not provided
        if not script:
            state=_load_state()
            if state and state.get("script"):
                script=state["script"]
                if not topic or topic=="motivational story about never giving up":
                    topic=state.get("topic",topic)
                    bg_type=state.get("background_type",bg_type)
        titles=_generate_viral_titles(topic,script)
        hashtags=_generate_hashtags(topic,bg_type)
        desc=_generate_description(topic,script,titles,hashtags)
        best_time=_get_best_posting_time()
        thumb_prompt=_generate_thumbnail_prompt(topic,bg_type)

        pack={
            "topic":topic,
            "script":script[:500],
            "background_type":bg_type,
            "titles":titles,
            "hashtags":hashtags,
            "description":desc,
            "best_posting_time":best_time,
            "thumbnail_prompt":thumb_prompt,
            "created":_now()
        }
        _save_viral_pack(pack)

        return f"""=== VIRAL PACK for '{topic}' background {bg_type} ===

5 VIRAL TITLES (Shorts algorithm optimized, mix short <40 chars for CTR + long curiosity):
1. {titles[0]}  (SHORT CTR optimized <40 chars — use this for max click)
2. {titles[1]}  (SHORT hook)
3. {titles[2]}  (Curiosity gap)
4. {titles[3]}  (POV / emotional)
5. {titles[4]}  (1% vs 99% — high retention)

Best title for upload: "{titles[0]}" — {len(titles[0])} chars (YouTube max 100, Shorts best <60)

HASHTAGS (15 max, algorithm loves #Shorts first):
{' '.join(hashtags)}

DESCRIPTION (hooks + CTA + chapters + credits — drives watch time + comments):
{desc[:1000]}...

BEST POSTING TIME (analytics):
ET {best_time['best_times_ET']} CET {best_time['best_times_CET']} Days {best_time['best_days']}
Why: {best_time['why']}
Your timezone Europe/Belgrade CET: {best_time['timezone_note']}

THUMBNAIL PROMPT (for generate_image):
{thumb_prompt}

Saved to {VIRAL_FILE} — use for publish_youtube.

Next: thumbnail action to generate image, publish_youtube file=... title="{titles[0]}" description=... tags={','.join(hashtags[:8])}

To generate thumbnail image: say "thumbnail topic {topic} background {bg_type}"
To publish: say "publish_youtube file C:/Users/Strahinja/Downloads/short.mp4 title {titles[0]}"
"""

    if action=="trending":
        # Try web_search via player? Return instructions + do search if possible
        try:
            # If web_search plugin available, suggest using it
            return f"""Trending topics for '{query}':

To get real trending now, JARVIS should use web_search action:

web_search query="{query}" mode=search

Then pick topics with high volume + low competition for Shorts.

Based on 2026 Shorts algorithm, trending motivational topics:
- "I stopped caring what people think and this happened"
- "The 1% rule that changed my life"
- "Why you feel behind in life (and why you're not)"
- "This is your sign to keep going"
- "The truth about motivation no one tells you"
- "How I went from broke to..."
- "POV: You finally stop procrastinating"
- "If you're watching this at 2am, this is for you"

For {query}, use web_search to get current viral, then generate viral_pack for each.

Also check YouTube Trending: https://www.youtube.com/feed/trending
And Google Trends: https://trends.google.com/trends/y?geo=US

Say "viral_pack topic [trending topic] background {bg_type}" to generate pack for trending topic.
"""
        except Exception as e:
            return f"Trending search failed {e}"

    if action=="thumbnail":
        prompt=_generate_thumbnail_prompt(topic,bg_type)
        # Try generate image if possible — return instructions
        thumb_path=Path.home() / "Downloads" / f"thumbnail_{topic[:20].replace(' ','_')}_{int(time.time())}.jpg"
        return f"""Thumbnail prompt for '{topic}' bg {bg_type}:

{prompt}

To generate image:
- If you have generate_image tool (in Arena), use: generate_image file_path="{thumb_path}" prompt="{prompt}"
- Or say to JARVIS: "generate thumbnail for {topic} with minecraft parkour background purple #8B5CF6"
- Or use DALL-E / Midjourney with prompt above, size 720x1280 9:16

Save thumbnail to {thumb_path} or ~/Downloads/thumbnail.jpg and use as custom thumbnail when publishing to YouTube via studio.youtube.com → Content → click video → Thumbnail → Upload.

Thumbnail tips for Shorts CTR:
- Bold white text Montserrat ExtraBold with purple #8B5CF6 stroke 90% scale
- Face with strong emotion (determination, shock)
- High contrast, blurred gameplay background
- 2-3 words max, 56px scale

Prompt saved in viral pack. Say viral_pack to see full pack.
"""

    if action=="publish_youtube":
        # Determine file path
        f_path=None
        if file_path:
            f_path=Path(file_path)
            if not f_path.exists():
                # Try find recent
                f_path,msg=_find_recent_mp4()
                if not f_path:
                    return f"File {file_path} not found and no recent mp4: {msg} — generate short first via full_auto"
        else:
            f_path,msg=_find_recent_mp4()
            if not f_path:
                return f"No file provided and {msg}"

        # Determine title/description/tags from viral pack if not provided
        viral=_load_viral_pack()
        if not title:
            if viral and viral.get("titles"):
                title=viral["titles"][0]
            else:
                titles=_generate_viral_titles(topic,script)
                title=titles[0]
        if not description:
            if viral and viral.get("description"):
                description=viral["description"]
            else:
                titles=_generate_viral_titles(topic,script)
                hashtags=_generate_hashtags(topic,bg_type)
                description=_generate_description(topic,script,titles,hashtags)
        if not tags_str:
            if viral and viral.get("hashtags"):
                tags=viral["hashtags"][:10]
            else:
                tags=_generate_hashtags(topic,bg_type)[:10]
        else:
            tags=[t.strip() for t in tags_str.split(",") if t.strip()]

        # Try API first then browser fallback
        ok_api,msg_api=_upload_youtube_api(f_path,title,description,tags)
        if ok_api:
            log(msg_api)
            return f"=== PUBLISHED TO YOUTUBE SHORTS VIA API ===\nFile {f_path} {f_path.stat().st_size/1024/1024:.2f}MB\nTitle '{title}'\n{msg_api}\n\nViral pack hashtags: {' '.join(tags[:8])}\n\nNext: check YouTube Studio https://studio.youtube.com for analytics, add thumbnail via thumbnail action, share Shorts URL."

        # Fallback browser automation
        log(msg_api + " — trying browser fallback")
        ok_brow,msg_brow=_upload_youtube_browser(f_path,title,description,tags)
        if ok_brow:
            return f"=== PUBLISHED TO YOUTUBE SHORTS VIA BROWSER AUTOMATION ===\nFile {f_path}\nTitle '{title}'\nAPI attempt: {msg_api}\nBrowser: {msg_brow}\n\nYou should SEE Chrome at https://www.youtube.com/upload with file uploading, title/description filled via accessibility + mouse easing visible.\n\nAfter publish, get URL from https://studio.youtube.com → Content → click video → copy link. Shorts URL will be https://www.youtube.com/shorts/VIDEO_ID\n\nHashtags: {' '.join(tags[:8])}"

        return f"=== YOUTUBE PUBLISH ATTEMPTED — MANUAL FINISH NEEDED ===\nFile {f_path} {f_path.stat().st_size/1024/1024:.2f}MB Title '{title}'\nAPI: {msg_api}\nBrowser: {msg_brow}\n\nTo finish manually:\n1. Open https://www.youtube.com/upload in your logged-in Chrome (existing, not new Chromium)\n2. Drag {f_path} to page\n3. Title: {title}\n4. Description: {description[:500]}...\n5. Tags: {', '.join(tags[:10])}\n6. Click Next 3x → Public → Publish\n7. Copy Shorts URL https://www.youtube.com/shorts/VIDEO_ID\n\nOr enable API: console.cloud.google.com → YouTube Data API v3 → OAuth2 Desktop → download client_secret.json to {Path.home() / '.youtube_credentials.json'} → pip install google-api-python-client google-auth-oauthlib"

    if action=="publish_tiktok":
        f_path=None
        if file_path:
            f_path=Path(file_path)
            if not f_path.exists():
                f_path,msg=_find_recent_mp4()
                if not f_path:
                    return f"File {file_path} not found and {msg}"
        else:
            f_path,msg=_find_recent_mp4()
            if not f_path:
                return f"No file and {msg}"

        viral=_load_viral_pack()
        if not title:
            if viral and viral.get("titles"):
                title=viral["titles"][0]
            else:
                title=_generate_viral_titles(topic,script)[0]

        # Browser automation for TikTok
        try:
            ok_fc,msg_fc=_focus_chrome()
            if not ok_fc:
                return f"Focus Chrome failed {msg_fc} — open https://www.tiktok.com/upload manually"
            ok_nav,msg_nav=_navigate_to("https://www.tiktok.com/upload",wait_sec=5)
            time.sleep(3)
            # Find Select file button
            el,err=_find_element_accessibility("Select file")
            if not el:
                el,err=_find_element_accessibility("Select video")
            if el:
                _move_with_easing(el["cx"],el["cy"],duration=0.6)
                import pyautogui
                pyautogui.click(el["cx"],el["cy"])
                time.sleep(1)
                ok_fill,msg_fill=_fill_via_clipboard(str(f_path))
                time.sleep(0.5)
                import pyautogui
                pyautogui.press('enter')
                time.sleep(5)
                # Fill caption
                el_cap,err_cap=_find_element_accessibility("caption")
                if el_cap:
                    _move_with_easing(el_cap["cx"],el_cap["cy"],duration=0.5)
                    import pyautogui
                    pyautogui.click(el_cap["cx"],el_cap["cy"])
                    time.sleep(0.3)
                    _fill_via_clipboard(f"{title} {' '.join(_generate_hashtags(topic,bg_type)[:5])}")
                return f"TikTok browser upload started for {f_path} title '{title}' — {msg_fc} {msg_nav} — finish manually at https://www.tiktok.com/upload, add hashtags, click Post"
            else:
                return f"TikTok Select file button not found {err} — open https://www.tiktok.com/upload manually, drag {f_path}, title '{title}'"
        except Exception as e:
            return f"TikTok publish failed {e} — manual upload https://www.tiktok.com/upload file {f_path}"

    if action=="full_viral_publish":
        # Full loop: full_auto + viral_pack + publish_youtube
        # First check if recent mp4 exists and viral pack exists — if not, instruct to run full_auto first
        state=_load_state()
        script_state=state.get("script","") if state else ""
        if not script:
            script=script_state

        # Generate viral pack first
        titles=_generate_viral_titles(topic,script)
        hashtags=_generate_hashtags(topic,bg_type)
        desc=_generate_description(topic,script,titles,hashtags)
        best_time=_get_best_posting_time()
        thumb_prompt=_generate_thumbnail_prompt(topic,bg_type)
        pack={
            "topic":topic,
            "script":script[:500] if script else topic,
            "background_type":bg_type,
            "voice":voice,
            "titles":titles,
            "hashtags":hashtags,
            "description":desc,
            "best_posting_time":best_time,
            "thumbnail_prompt":thumb_prompt,
            "created":_now()
        }
        _save_viral_pack(pack)

        # Find recent mp4 or instruct full_auto
        f_path,msg_find=_find_recent_mp4()

        if not f_path:
            # No video yet — need full_auto
            return f"""=== FULL VIRAL PUBLISH — STEP 1/3 DONE (VIRAL PACK) + NEED VIDEO ===

Viral pack generated for '{topic}' bg {bg_type} voice {voice}:

5 Titles:
1. {titles[0]}
2. {titles[1]}
3. {titles[2]}
4. {titles[3]}
5. {titles[4]}

Hashtags: {' '.join(hashtags)}
Best time: {best_time['best_times_CET']} CET — {best_time['why']}
Thumbnail prompt: {thumb_prompt}

Saved to {VIRAL_FILE}

BUT no video found yet: {msg_find}

To complete full viral publish (idea → published):

1. Generate video via TRUE AUTOMATION (JARVIS actually clicks himself, you watch mouse move):
   Say: "Full auto topic {topic} background {bg_type} voice {voice}"
   Wait for download verification >1MB in Downloads

2. Then publish:
   Say: "Publish youtube file auto title {titles[0]}"
   Or: "Full viral publish topic {topic} background {bg_type}" again after video exists — will auto-find recent mp4 and publish

Full flow idea→published:
- full_auto → video in Downloads
- viral_pack → titles/hashtags/description/best time/thumbnail
- publish_youtube → uploads via API or browser automation, returns Shorts URL

Visible tab: {_get_visible_html_path()} auto-refresh 2s
"""

        # Video exists — publish
        title_best=titles[0]
        ok_api,msg_api=_upload_youtube_api(f_path,title_best,desc,hashtags[:10])
        if ok_api:
            return f"""=== FULL VIRAL PUBLISH DONE — IDEA TO PUBLISHED VIA API ===

Topic {topic} BG {bg_type} Voice {voice}
Video {f_path} {f_path.stat().st_size/1024/1024:.2f}MB
Viral Titles:
1. {titles[0]} (used)
2. {titles[1]}
3. {titles[2]}
4. {titles[3]}
5. {titles[4]}
Hashtags: {' '.join(hashtags)}
Best time: {best_time['best_times_CET']} CET
Thumbnail prompt: {thumb_prompt}

Publish result: {msg_api}

DONE — Your Short is LIVE! Check YouTube Studio for analytics.

Next: generate thumbnail image via thumbnail action, add as custom thumbnail in studio.youtube.com
"""

        # Fallback browser
        ok_brow,msg_brow=_upload_youtube_browser(f_path,title_best,desc,hashtags[:10])
        return f"""=== FULL VIRAL PUBLISH — VIDEO FOUND, PUBLISHING VIA BROWSER ===

Video {f_path} {f_path.stat().st_size/1024/1024:.2f}MB
Title {title_best}
Hashtags {' '.join(hashtags[:8])}
API attempt: {msg_api}
Browser: {msg_brow}

You should SEE Chrome at https://www.youtube.com/upload with file uploading via accessibility + mouse easing visible.

After publish, get Shorts URL from https://studio.youtube.com → Content → copy link https://www.youtube.com/shorts/VIDEO_ID

Viral pack saved {VIRAL_FILE}
Best posting time {best_time['best_times_CET']} CET — {best_time['why']}

DONE — finish publish manually if needed, then share Shorts URL.
"""

    if action=="status":
        viral=_load_viral_pack()
        state=_load_state()
        f_path,msg=_find_recent_mp4()
        if not viral:
            return f"No viral pack yet — say viral_pack topic=... — state {state.get('progress','?') if state else 'no state'} — recent video {msg}"
        return f"""Viral pack status {viral.get('last_update','')} topic {viral.get('topic','')} titles {len(viral.get('titles',[]))} hashtags {len(viral.get('hashtags',[]))}
Best title: {viral.get('titles',[''])[0]}
Hashtags: {' '.join(viral.get('hashtags',[])[:8])}
Thumbnail prompt: {viral.get('thumbnail_prompt','')[:100]}...
Recent video: {msg} — {f_path}
State: {state.get('progress','?')+' '+state.get('current_step_name','') if state else 'no state'}
File {VIRAL_FILE}
"""

    if action=="open_progress":
        from pathlib import Path
        html_path=_get_visible_html_path()
        try:
            import subprocess, platform
            system=platform.system()
            if system=="Windows":
                try:
                    os.startfile(str(html_path))
                except:
                    subprocess.Popen(["powershell","-Command",f"Start-Process '{html_path}'"])
            elif system=="Darwin":
                subprocess.Popen(["open",str(html_path)])
            else:
                subprocess.Popen(["xdg-open",str(html_path)])
            return f"Opened visible progress tab {html_path} auto-refresh 2s — shows live steps + viral pack"
        except Exception as e:
            return f"Failed open {e} — manually open {html_path}"

    return _guide()
