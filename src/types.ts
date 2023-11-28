export interface ConnectMessage {
	type: 'CONNECT',
	userId: string,
	docId: string,
}

export interface DisconnectMessage {
	type: 'DISCONNECT',
	userId: string,
}

export interface InsertCharMessage {
	type: 'INSERT_CHAR',
	lineIdx: number,
	columnIdx: number,
	char: string,
	userId: string,
}

export interface InsertLineBreakMessage {
	type: 'INSERT_LINE_BRK',
	lineIdx: number,
	columnIdx: number,
	userId: string,
}

export interface DeleteCharMessage {
	type: 'DELETE_CHAR',
	lineIdx: number,
	columnIdx: number,
	userId: string,
}

export interface DeleteLineBreakMessage {
	type: 'DELETE_LINE_BRK',
	lineIdx: number,
	userId: string,
}

export interface ChangeDocNameMessage {
	type: 'CHANGE_DOC_NAME',
	newName: string,
	userId: string,
}

export interface DocumentOperationAnswer {
	document: {
		id: string,
		name: string,
		content: string,
	},
	user: {
		id: string,
		name: string,
	},
}