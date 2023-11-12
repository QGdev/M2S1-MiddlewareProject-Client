export interface ConnectMessage {
	type: 'CONNECT',
	userId: string,
	docId: string,
}
export interface InsertMessage {
	type: 'INSERT',
	lineIdx: number,
	columnIdx: number,
	char: string,
	userId: string,
}
export interface DeleteLineBreakMessage {
	type: 'DELETE_LINE_BRK',
	lineIdx: number,
	userId: string,
}
export interface DeleteCharMessage {
	type: 'DELETE_CHAR',
	lineIdx: number,
	columnIdx: number,
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