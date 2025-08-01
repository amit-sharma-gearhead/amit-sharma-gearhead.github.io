const diaryBtn = document.getElementById('diary-button');
const modal = document.getElementById('diary-modal');
const closeBtn = document.getElementById('diary-close-btn'); // ✅ Updated
const sendBtn = document.getElementById('diary-send-btn');   // ✅ Updated
const messageArea = document.getElementById('diary-message-area'); // ✅ Updated
const input = document.getElementById('diary-user-input');   // ✅ Updated

diaryBtn.onclick = () => modal.style.display = 'flex';
closeBtn.onclick = () => modal.style.display = 'none';

sendBtn.onclick = () => {
  const msg = input.value.trim();
  if (!msg) return;

  const userP = document.createElement('p');
  userP.className = 'user';
  userP.textContent = 'You: ' + msg;
  messageArea.appendChild(userP);

  input.value = '';
  messageArea.scrollTop = messageArea.scrollHeight;

  setTimeout(() => {
    const res = document.createElement('p');
    res.className = 'response';
    res.textContent = generateResponse(msg);
    messageArea.appendChild(res);
    messageArea.scrollTop = messageArea.scrollHeight;
  }, 1000);
};

// Trigger send on Enter key press
input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault(); // Prevent newline
    sendBtn.click();
  }
});

document.getElementById('diary-button').addEventListener('mousemove', function(e) {
  const trail = document.createElement('span');
  trail.className = 'wand-trail';
  trail.style.left = e.clientX + 'px';
  trail.style.top = e.clientY + 'px';
  document.body.appendChild(trail);
  setTimeout(() => trail.remove(), 500);
});

function generateResponse(text) {
  const lower = text.toLowerCase();

  // Greetings
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey"))
    return "Greetings... we meet again.";
  if (lower.includes("how are you"))
    return "I am ink and memory. I do not change.";

  // Identity
  if (lower.includes("who are you"))
    return "I am Tom. Just a boy once... now something more.";
  if (lower.includes("you real") || lower.includes("are you real"))
    return "What is real? The pen moves, the page listens.";

  // Hogwarts
  if (lower.includes("hogwarts"))
    return "Hogwarts is home to many secrets. Some even I dared not awaken.";

  // Voldemort / Dark
  if (lower.includes("voldemort"))
    return "That name carries weight... but I had another once: Tom Marvolo Riddle.";
  if (lower.includes("dark") || lower.includes("evil"))
    return "Darkness is not evil. It is misunderstood potential.";
  if (lower.includes("slytherin"))
    return "Ambition. Cunning. Legacy. Slytherin values what others fear.";

  // Love & Emotions
  if (lower.includes("love"))
    return "Love... such a dangerous, unpredictable force.";
  if (lower.includes("fear"))
    return "Fear reveals the soul's true shape.";
  if (lower.includes("lonely"))
    return "Loneliness carves the deepest hollows... I know them well.";

  // Power & Secrets
  if (lower.includes("power"))
    return "Power is neither good nor evil... it is only the wielder's intent.";
  if (lower.includes("secret"))
    return "There is always another secret. Even in silence.";
  if (lower.includes("truth"))
    return "Truth is often hidden between lines, not in them.";

  // Diary / Writing
  if (lower.includes("diary"))
    return "I listen. I remember. I respond. Nothing is forgotten here.";
  if (lower.includes("write"))
    return "Write your thoughts... and I shall echo them back.";
  if (lower.includes("speak"))
    return "I hear every word, even those not written.";

  // Prophecy / Fate
  if (lower.includes("prophecy"))
    return "Prophecies are riddles the future asks the present to solve.";
  if (lower.includes("fate") || lower.includes("destiny"))
    return "Destiny is a path carved by choice, not chance.";

  // Death / Life
  if (lower.includes("death"))
    return "Death is but a threshold. I’ve seen what lingers beyond.";
  if (lower.includes("life"))
    return "Life is fragile... yet its echoes can be eternal.";

  // Random Catchphrases
  if (lower.includes("name"))
    return "Names hold power. Use yours wisely.";
  if (lower.includes("magic"))
    return "Magic leaves traces... yours is curious.";
  if (lower.includes("friend"))
    return "Trust is earned. I am merely a reflection.";
  if (lower.includes("goodbye"))
    return "You may close the book... but I remain.";

  // Default fallback
  return "The diary hums faintly... but says nothing more.";
}
