#!/usr/bin/env bash
# Generates the 13 call clips with ElevenLabs and writes app/audio/manifest.json.
# Needs only curl and python3 (both ship with macOS). Run from anywhere inside the repo:
#   ELEVEN_API_KEY=your_key ./scripts/make-voices.sh
# The key is read from the environment only; nothing here stores it. Clips are gitignored
# except manifest.json, so commit app/audio deliberately: git add -f app/audio && git commit -m "Recorded voices"
set -euo pipefail
: "${ELEVEN_API_KEY:?set ELEVEN_API_KEY in the environment}"
ROSA="${ROSA_VOICE_ID:-EXAVITQu4vr4xnSDxMaL}"       # Sarah: warm, measured; change to taste
ADV="${ADVOCATE_VOICE_ID:-TX3LPaxmHKxFdv7VOQHJ}"     # Liam: calm, younger male
MODEL="${ELEVEN_MODEL:-eleven_multilingual_v2}"
cd "$(dirname "$0")/.."
mkdir -p app/audio
i=0; files=()
say() { # speaker, text
  local who="$1" text="$2" id f body
  if [ "$who" = Rosa ]; then id="$ROSA"; else id="$ADV"; fi
  f=$(printf "%02d.mp3" "$i")
  printf '%s %s: %s\n' "$f" "$who" "$text"
  body=$(python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1], "model_id": sys.argv[2], "voice_settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.15, "use_speaker_boost": True}}))' "$text" "$MODEL")
  if ! curl -fsS -X POST "https://api.elevenlabs.io/v1/text-to-speech/$id?output_format=mp3_44100_128" \
      -H "xi-api-key: $ELEVEN_API_KEY" -H "Content-Type: application/json" --data "$body" -o "app/audio/$f"; then
    echo "ElevenLabs refused line $i. Check the key and that the voice ids exist in your account (Voices page)." >&2; exit 1
  fi
  files+=("$f"); i=$((i+1))
}
# Verify step (6 lines) then the call (7 lines). Order must match VERIFY and CALL in app/index.html.
say Advocate "Thanks for calling. Before I can look at anything, can I get your full name?"
say Rosa "Rosa Martinez."
say Advocate "And your date of birth?"
say Rosa "March 9th, 1955."
say Advocate "Last four of your member ID?"
say Rosa "4821."
say Rosa "This is the third time I've called about this bill from the skin doctor."
say Advocate "I'm sorry, Rosa. I can see both earlier calls, so you won't have to repeat yourself. Let's sort it out."
say Rosa "They billed me 120 dollars for a specialist visit, and I thought I only pay 35."
say Advocate "Let me check whether a referral was on file for September 30th."
say Rosa "While I have you... if I go to the E R and they admit me, what do I owe?"
say Rosa "And my mother is in rehab. They are sending her home tomorrow, and she is not ready."
say Advocate "I'm bringing a supervisor onto the call for that right now."
python3 -c 'import json,sys; json.dump({"lines": sys.argv[1:]}, open("app/audio/manifest.json","w"))' "${files[@]}"
echo "Wrote app/audio/manifest.json with ${#files[@]} clips. Open app/ and the call plays with recorded voices."
