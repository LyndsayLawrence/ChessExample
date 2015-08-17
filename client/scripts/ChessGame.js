//------------------------------------
// Constants
//------------------------------------
var EXTENSION_NAME = "ChessCube";
var BOARD_SIZE = 300;
var BOARD_BORDER = 8;
var PIECE_SIZE = 36;
var FPS = 40;

//------------------------------------
// Vars
//------------------------------------
var inited = false;
var canvas;
var stage;
var board;
var game;
var squares = [];

var p1NameCont;
var p2NameCont;

var statusTF;

var disabler;
var currentPopUp;

var gameStarted = false;
var iAmSpectator = false;

var whoseTurn;
var player1Id;
var player2Id;
var player1Name;
var player2Name;

/**
 * Initialize the game
 */
function initGame(){
	if(inited == false){
		inited = true;
		
		//Stage
		canvas = document.getElementById("gameContainer");
		stage = new createjs.Stage(canvas);
		stage.mouseEventsEnabled = true;
		
		//Ticker
		createjs.Ticker.setFPS(FPS);
		
		//Board
		buildGameUI();
	}
	
	createjs.Ticker.addListener(tick);
	
	gameStarted = false;
	
	// Register to SmartFox events
	sfs.addEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onExtensionResponse);
	sfs.addEventListener(SFS2X.SFSEvent.SPECTATOR_TO_PLAYER, onSpectatorToPlayer);
	
	resetGameBoard();
	
	// Setup my properties
	iAmSpectator = (sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == -1);
	
	// Show "wait" message
	var message = "Waiting for player " + ((sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == 1) ? "2" : "1")
	
	if (iAmSpectator == false)
		showGamePopUp("wait", message);
	
	// Tell extension I'm ready to play
	sfs.send( new SFS2X.Requests.System.ExtensionRequest("ready", {}, sfs.lastJoinedRoom) )
}

/**
 * Add game's elements to the canvas
 */
function buildGameUI(){
	//--------------------------
	// Board
	//--------------------------
	game = new Chess();

	var removeGreySquares = function() {
		$('#board .square-55d63').css('background', '');
	};

	var greySquare = function(square) {
		var squareEl = $('#board .square-' + square);

		var background = '#a9a9a9';
		if (squareEl.hasClass('black-3c85d') === true) {
			background = '#696969';
		}

		squareEl.css('background', background);
	};

	var onDragStart = function(source, piece) {
		// do not pick up pieces if the game is over
		// or if it's not that side's turn
		if (game.game_over() === true ||
			(game.turn() === 'w' && piece.search(/^b/) !== -1) ||
			(game.turn() === 'b' && piece.search(/^w/) !== -1)) {
			return false;
		}
	};

	var onDrop = function(source, target) {
		removeGreySquares();

		// see if the move is legal
		var move = game.move({
			from: source,
			to: target,
			promotion: 'q' // NOTE: always promote to a queen for example simplicity
		});

		// illegal move
		if (move === null) return 'snapback';
	};

	var onMouseoverSquare = function(square, piece) {
		// get list of possible moves for this square
		var moves = game.moves({
			square: square,
			verbose: true
		});

		// exit if there are no moves available for this square
		if (moves.length === 0) return;

		// highlight the square they moused over
		greySquare(square);

		// highlight the possible squares for this piece
		for (var i = 0; i < moves.length; i++) {
			greySquare(moves[i].to);
		}
	};

	var onMouseoutSquare = function(square, piece) {
		removeGreySquares();
	};

	var onSnapEnd = function() {
		board.position(game.fen());
	};

	var cfg = {
		draggable: true,
		position: 'start',
		onDragStart: onDragStart,
		onDrop: onDrop,
		onMouseoutSquare: onMouseoutSquare,
		onMouseoverSquare: onMouseoverSquare,
		onSnapEnd: onSnapEnd
	};
	board = ChessBoard('board', cfg);
}

/**
 * Update the canvas
 */
function tick() {
    stage.update();
}

/**
 * Destroy the game instance
 */
function destroyGame(){
	sfs.removeEventListener(SFS2X.SFSEvent.EXTENSION_RESPONSE, onExtensionResponse);
	sfs.removeEventListener(SFS2X.SFSEvent.SPECTATOR_TO_PLAYER, onSpectatorToPlayer);

	//Remove PopUp
	removeGamePopUp();
}

/**
 * Start the game
 */
function startGame(params){
	whoseTurn = params.t;
	player1Id = params.p1i;
	player2Id = params.p2i;
	player1Name = params.p1n;
	player2Name = params.p2n;
	
	// Reset the game board
	resetGameBoard();
	
	// Remove the "waiting for other player..." popup
	removeGamePopUp();
	
	p1NameCont.name.text = player1Name;
	p2NameCont.name.text = player2Name;
	
	setTurn();
	enableBoard(true);
	
	gameStarted = true;
}

/**
 * Set the "Player's turn" status message
 */
function setTurn(){
	if(iAmSpectator == false){
		statusTF.text = (sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == whoseTurn) ? "It's your turn" : "It's your opponent's turn";
	}else{
		statusTF.text = "It's " + this["player" + whoseTurn + "Name"] + " turn";
	}
}

/**
 * Clear the game board
 */
function resetGameBoard(){
	board.start();
	game.reset();
}

/**
 * Enable board click
 */
function enableBoard(enable){
	if(iAmSpectator == false && sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == whoseTurn)
	{
		for(var i = 0; i<9; i++){
			var square = squares[i];
			
			if(square.ball.currentFrame == 0)
			{
				if(enable)
					square.onClick = makeMove;
				else
					square.onClick = null;
			}
		}
	}
}

/**
 * On board click, send move to other players
 */
function makeMove(evt){
	var square = evt.target;
	square.ball.gotoAndStop(sfs.mySelf.getPlayerId(sfs.lastJoinedRoom));
	square.onClick = null;
	
	enableBoard(false);
	
	var x = square.id % 3 + 1;
	var y = Math.floor(square.id / 3) + 1;
	
	var obj = {};
		obj.x = x;
		obj.y = y;
	
	sfs.send( new SFS2X.Requests.System.ExtensionRequest("move", obj, sfs.lastJoinedRoom) )
}

/**
 * Handle the opponent move
 */
function moveReceived(params){
	var movingPlayer = params.t;
	whoseTurn = (movingPlayer == 1) ? 2 : 1;
	
	if(movingPlayer != sfs.mySelf.getPlayerId(sfs.lastJoinedRoom))
	{
		var square = squares[(params.y-1) * 3 + (params.x-1)];
		square.ball.gotoAndStop(movingPlayer);
	}
	
	setTurn();
	enableBoard(true);
}

/**
 * Declare game winner
 */
function showWinner(cmd, params){
	gameStarted = false;
	statusTF.text = "";
	var message = "";
	
	if(cmd == "win")
	{
		if(iAmSpectator == true)
		{
			var pName = this["player" + params.w + "Name"];
			message = pName + " is the WINNER";
		}
		else
		{
			if(sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == params.w)
			{
				// I WON! In the next match, it will be my turn first
				message = "You are the WINNER!"
			}
			else
			{
				// I've LOST! Next match I will be the second to move
				message = "Sorry, you've LOST!"
			}
		}
	}
	else if(cmd == "tie")
	{
		message = "It's a TIE!"
	}
	
	// Show "winner" message
	if(iAmSpectator == true){
		showGamePopUp("endSpec", message);
	}else{
		showGamePopUp("end", message);
	}
}

/**
 * Restart the game
 */
function restartGame()
{
	removeGamePopUp();
	
	sfs.send( new SFS2X.Requests.System.ExtensionRequest("restart", {}, sfs.lastJoinedRoom) )
}

/**
 * One of the players left the game
 */
function userLeft()
{
	gameStarted = false;
	statusTF.text = "";
	var message = "";
	
	// Show "wait" message
	if(iAmSpectator == false){
		message = "Your opponent left the game" + "<br/><br/>" + "Waiting for a new player";
		showGamePopUp("wait", message);
	}else{
		message = "A player left the game" + "<br/><br/>" + "Press the Join button to play"
		showGamePopUp("waitSpec", message);
	}
}

/**
 * Spectator receives board update. If match isn't started yet,
 * a message is displayed and he can click the join button
 */
function setSpectatorBoard(params)
{
	removeGamePopUp();
	
	whoseTurn = params.t;
	player1Id = params.p1i;
	player2Id = params.p2i;
	player1Name = params.p1n;
	player2Name = params.p2n;
	
	gameStarted = params.status;
	
	p1NameCont.name.text = player1Name;
	p2NameCont.name.text = player2Name;
	
	if(gameStarted == true)
		setTurn();
	
	var boardData = params.board;
	
	for (var y = 0; y<boardData.length; y++){
		var boardRow = boardData[y];
		for(var x = 0; x<boardRow.length; x++){
			var square = squares[y * 3 + x];
			square.ball.gotoAndStop(boardRow[x]);
		}
	}
	
	if(gameStarted == false)
	{
		var message = "Waiting for game to start" + "<br/><br/>" + "Press the Join button to play";
		showGamePopUp("waitSpec", message);
	}
}

/**
 * If a spectator enters the game room and the match isn't started yet,
 * he can click the join button
 */
function spectatorJoinGame()
{
	sfs.send( new SFS2X.Requests.System.SpectatorToPlayerRequest() );
}

//------------------------------------
// Game Popup
//------------------------------------
/**
 * Show the Game PopUp
 */
function showGamePopUp(id, message){
	if(currentPopUp != undefined)
		removeGamePopUp();
	
	disabler.visible = true;
	
	currentPopUp = $("#"+id+"GameWin");
	
	currentPopUp.jqxWindow("open");
	currentPopUp.jqxWindow("move", (canvas.width/2) - (currentPopUp.jqxWindow("width") / 2) + canvas.offsetLeft, (canvas.height/2) - (currentPopUp.jqxWindow("height") / 2) + canvas.offsetTop);
	currentPopUp.children(".content").children("#firstRow").children("#message").html(message);
}

/**
 * Hide the Game PopUp
 */
function removeGamePopUp(){
	if(currentPopUp != undefined){
		disabler.visible = false;
		
		currentPopUp.jqxWindow("close");
		currentPopUp = undefined;
	}
}

//------------------------------------
// SFS EVENT HANDLERS
//------------------------------------

function onExtensionResponse (evt){
	var params = evt.params;
	var cmd = evt.cmd;
	
	console.log("> Received Extension Response: "+cmd)
	
	switch(cmd){
		case "start":
			startGame(params);
			break;
		case "stop":
			userLeft();
			break;
		case "move":
			moveReceived(params);
			break;
		case "specStatus":
			setSpectatorBoard(params);
			break;
		case "win":
		case "tie":
			showWinner(cmd, params);
			break;
	}
}

function onSpectatorToPlayer(evt){
	var updatedUser = evt.user;
	
	if(updatedUser.isItMe){
		iAmSpectator = false;
		
		// Show "wait" message
		removeGamePopUp()
		var message = "Waiting for player " + ((sfs.mySelf.getPlayerId(sfs.lastJoinedRoom) == 1) ? "2" : "1")
		showGamePopUp("wait", message)
	}
}