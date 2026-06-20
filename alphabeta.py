def print_board(board):
    print()
    for i in range(0, 9, 3):
        print(f" {board[i]} | {board[i+1]} | {board[i+2]} ")
        if i < 6:
            print("---+---+---")
    print()

def check_winner(board, player):
    win_conditions = [
        [0,1,2], [3,4,5], [6,7,8], # rows
        [0,3,6], [1,4,7], [2,5,8], # cols
        [0,4,8], [2,4,6] # diags
    ]
    return any(all(board[i] == player for i in condition) for condition in win_conditions)

def is_draw(board):
    return all(cell in ['X', 'O'] for cell in board)

def tic_tac_toe():
    board = [str(i+1) for i in range(9)] # positions 1-9
    current_player = 'X'

    while True:
        print_board(board)
        move = input(f"Player {current_player}, choose position 1-9: ")

        if not move.isdigit() or int(move) not in range(1, 10):
            print("Invalid input. Pick a number 1-9.")
            continue

        idx = int(move) - 1
        if board[idx] in ['X', 'O']:
            print("That spot is taken. Try again.")
            continue

        board[idx] = current_player

        if check_winner(board, current_player):
            print_board(board)
            print(f"Player {current_player} wins!")
            break

        if is_draw(board):
            print_board(board)
            print("It's a draw!")
            break

        current_player = 'O' if current_player == 'X' else 'X'

if __name__ == "__main__":
    tic_tac_toe()
