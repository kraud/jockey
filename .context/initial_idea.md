### Initial Idea - reference document (do not modify base text, but instead use as reference and append further clarifications at the bottom as they are discovered/definded).

We simply call this game "Horse racing". It's a game that can be played alone or with any amount of players. One player can 'play', but it's a better experience with multiple players.

The games simulates a horse racing environment where players bid on horses to win races. The game is played with the spanish deck of cards, with its 4 suits: Coins, Cups, Swords, Clubs. In this deck, the cards go from 1 to 12, with the number 11 traditionally displaying the picture of a person riding a horse, which become our riders for the race. One for each suit.

The horses are placed on the beginning of the track, one next to the other behind the starting line, ready to each go on their track (direction up), and the players bid on which horse they think will win each race, and no bids can be placed/changed after the race has started. Players are encouraged to all bid for different horses, but it is not mandatory, and more than one player can bid for the same horse. It's a personal preference.

The line of horses is placed at the bottom of the screen.

The track consists of a line of vertically aligned cards, facing down, on the left side of the screen, above the starting line. This way, the line of cards that represent the track is perpendicular to the starting line of horses, in a sort of L shape (at the intersection of these two lines, there is an empty space). Above the horses, their track is empty and staggered in steps, one card per step.

The length of the track is determined by the number of cards in the line, and can be customized by the player. The default is 6, and the finishing line is after the last card in the line. Each card represents a position on the track, and to win a race, a horse must reach the finishing line (so moving past the last card - not simply reaching it).

Once the horses are in place, and the track-cards are laid out, the game can begin, using the remaining cards in the deck.

These cards are shuffled and are drawn one at a time. Once the card is drawn, the horse that matches that card's suit moves one space forward along the track, and the card is discarded to the used pile. Only one card is drawn at a time, therefore only one horse moves along the track with each card drawn.

As more cards are drawn, the different horses move along the track, and the game continues until the first 3 horses have reached the finishing line (the remaning horse is automatically awarded 4th place). If the deck is exhausted before that, the used pile is reshuffled and the game continues.

Only when a track-card (step) has been reached by the last horse, that card is flipped face-up, and the horse that matches that card's suit regresses one space back along the track. This makes the back and forth movements of the horses on the track resemble in spirit a real horse track.

If a horse has already reached the finishing line, it cannot be moved along the track. So cards from the deck that match the suit of those horses are ignored, and the next card is drawn. The same applies to the track-card that matches the suit of a horse that has already reached the finishing line. That track-card is ignored, and no horse is moved.

The game at this stage is purely a luck based game. No strategy or skill is required to win. The entertainment value of the game lies in seeing the horses move along the track and the players are encouraged to cheer and lament when their horse moves ahead and back along the track, simulating the excitement of a real horse race. This is the end of the gameplay mechanics.

While the race develops, traditionally there is a race commentator (or 'race caller') who provide the live, play-by-play descriptions of races (like real commentators do for fans at the track/television/radio). They are highly skilled at rapidly naming horses/suits, keeping track of positions, and capturing the excitement of the final stretch.

On the first prototype, this works a drinking game. Players can bid on which horse (suit) they think will win each race. Depending on the result of the race, they are awarded 'sips of drink to give' or penalized with 'sips of drink to take'. There are only 4 possible placement results for a horse: 1st, 2nd, 3rd, or 4th place, with the following rewards/penalties for the respective placements:

1st Place: bidder is awarded twice the bid amount as 'drinks to give'
2nd Place: bidder is awarded the bid amount as 'drinks to give'.
3rd Place: bidder is penalized with the bid amount as 'drinks to take'.
4th Place: bidder is penalized with double the bid amount as 'drinks to take'.

After a race, all players can see their own counter for 'drinks to consume'.

Players that win 'drinks to give' can assign them their corresponding amount, to any other player (regardless of their bid placement) - so even if a player bid for the first-place winning horse, they can receive drinks from other players that also bid for that horse, or from the players that bid the horse that reached the finish line in second place. 

When assigning 'drinks to give', those can be split among multiple players, or be giving the full amount to a single player. 

When drinks are given to a player, that amount is added to their 'drinks to consume' counter. 

There is a 30 second limit for all drinks to be given, after which they are given at random to the other players.

Players that are penalized with 'drinks to take' are assigned those drinks the penalty immediately, increasing their 'drinks to consume' counter. The counter is updated when another player gives drinks to them.

After the 30 second limit, all players know how many drinks they need to consume. The players are presented with a 'ready' button, which they can press once they are done drinking their assigned drinks.

Once all players are ready, the game proceeds to the next round, where the whole process repeats (no state from the previous race is kept).

### Additional Notes

#### Implementation details

- Target concurrent players per game? Between 1 and 20 different users per room. The room-game relationship is one-to-one.
- Max expected simultaneous rooms? Indeterminate amount of rooms. When going into the site, it asks you to create a room or join an existing one (via QR code or room code).
- Latency tolerance? Real-time card reveals + race animation, or is server-driven "step snapshots" acceptable? For this first prototype, basic sync between the different clients is enough, no need for perfect frame/pixel sync, like in a fighting game.
- Persistence? Do you want to keep game history / replays, or are rounds fully ephemeral? For the first prototype, each round is fully ephemeral.
- Hosting budget? $0/mo prototype tier, or are you willing to spend a small amount? If possible, completely free hosting for the first prototype. No accounts, just creating rooms and playing.

The proposed loop is:
1. One player opens the site and creates a room (they become the host - but by default still are a player in the game but they can opt out and only host and manage the game for other players), and has a unique room code they can share with other users that want to join play with them.
  * 1.1: (optional) The host can change settings on the game, like length of the track, and other parameters to be determined later. All players in the room percibe the results of these settings, but cannot change them themselves.
  * 1.2: (optional) The host can lock the room, preventing any further players from joining.
  * 1.3: (optional) The host can at any time kick any player from the room.
2. Other players can be added into the room, via one of the following methods:
  * 2.a: Other users join the room from their own devices (browsers) using the room code (let's call them 'independent players'). They have to choose a name to display. They will handle their own bets, drink distribution, etc.
  * 2.b: The host can add other players to the room (let's call them 'hosted players').  If so, the host is in charge of managing the game for those players (choosing suit, specifying bet, distributing drinks, etc.). The host also sets the name for them. These players only spectate the game and their choices are executed by the host (useful for streaming or broadcasting the game to a larger audience - without having to rely on individual players to execute their choices).
3. At will, the host can start the game loop (even if they are the only player in the room).
4. Once the game loop starts, players choose their suit and place bets. The process is different for independent players and hosted players:
  * Independent players: They choose their suit and place bets independently, without the host's intervention, from their own devices. Once done, they submit their choices to the host and mark their bets as 'confirmed'. The host can manage their own bets - they are their own independent players.
  * Hosted players: They are managed by the host, who chooses their suit and places bets on their behalf. Once done, the host submits their choices and marks their bets as 'confirmed'.
5. The host (as well as all the independent players) can visualize the status of the bets to see if they are confirmed or not. At will, the host can start the next stage of the game loop, which is the race.
6. The race takes place as defined on the game_desing.md file.
7. Once the race is over, the settlement phase takes place and all the users are awarded their winnings/penalties according to the rules defined on the game_design.md file.
8. From here, the distribution phase begins. The host (and all the independent players) can then assign drinks to the players according to the rules defined on the game_design.md file. The default time limit for this is 30 seconds. From there, they are in a 'busy' state, and are informed of how many drinks they need to take.
9. Once they are done taking their drinks, they mark themselves as 'ready', to inform the host that they are ready to proceed. The host can proceed with the next stage of the game loop at any point (the ready signal is informational only - not a limitation for the host).
