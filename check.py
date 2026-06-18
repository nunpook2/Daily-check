import re

def check_divs(text):
    opens = 0
    lines = text.split('\n')
    for i, line in enumerate(lines):
        line_clean = re.sub(r'//.*', '', line) # naive remove comments
        # count <div...> and <motion.div...
        # and </div> and </motion.div>
        num_open = len(re.findall(r'<div[\s>]|<motion.div[\s>]', line_clean))
        num_close = len(re.findall(r'</div[\s>]|</motion.div>', line_clean))
        opens += (num_open - num_close)
        print(f"{i+1} : {opens} ( +{num_open} -{num_close} ) : {line.strip()[:40]}")

with open("src/components/Settings.tsx") as f:
    text = f.read()

check_divs(text)
