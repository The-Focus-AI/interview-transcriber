# Get metadata

yt-dlp --proxy "http://9YEi8p9D0pR2o3q2:6lco8HgcyzFXsIg1@geo.iproyal.com:12321" --skip-download --write-info-json "https://www.youtube.com/watch?v=xOO8Wt_i72s"

# List the formats

yt-dlp --proxy "http://9YEi8p9D0pR2o3q2:6lco8HgcyzFXsIg1@geo.iproyal.com:12321"  -vU --list-formats "https://www.youtube.com/watch?v=xOO8Wt_i72s"

# Download the audio

yt-dlp --proxy "http://9YEi8p9D0pR2o3q2:6lco8HgcyzFXsIg1@geo.iproyal.com:12321" -x -o output.mp4 "https://www.youtube.com/watch?v=xOO8Wt_i72s"

# Download smallest quality

yt-dlp --proxy http://9YEi8p9D0pR2o3q2:6lco8HgcyzFXsIg1@geo.iproyal.com:12321 -x --audio-format m4a --audio-quality 9 -o audio.m4a "https://www.youtube.com/watch?v=xOO8Wt_i72s"


http://9YEi8p9D0pR2o3q2:6lco8HgcyzFXsIg1_country-us@geo.iproyal.com:12321