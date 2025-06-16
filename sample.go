package main 

import (
	"fmt"
	"net/http"
	"github.com/savioxavier/termlink"
	"github.com/gorilla/websocket"
)


var upgrader = websocket.Upgrader{
	ReadBufferSize: 1024,
	WriteBufferSize: 1024,
	CheckOrigin : func(r *http.Request) bool {
		return true
	},
}

var peers = make(map[string]*websocket.Conn)



func handleWebSocket(w http.ResponseWriter, r *http.Request){
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Upgrade error: ", err)
		return 
	}

	defer conn.Close()
	var peerID string 


	for {
		var msg map[string]interface{}
		if err := conn.ReadJSON(&msg); err != nil{
			fmt.Println("Read error: ", err)
			break
		}


	action := msg["action"].(string)

	switch action {
	case "register":
		peerID = msg["peerID"].(string)
		peers[peerID] = conn
		fmt.Println("Peer registered: ", peerID)

	case "signal": 
		toID := msg["to"].(string)
		if targetConn, ok := peers[toID]; ok{
			targetConn.WriteJSON(msg)
			fmt.Println("Signalling message sent from", peerID, "to", toID)
			}
		}
	}


	if peerID != ""{
		delete(peers, peerID)
		fmt.Println("Peer Disconnected:", peerID)
	}
}


func serveStaticFiles() {
	fs := http.FileServer(http.Dir("./static"))
	http.Handle("/", fs)
}


func main() {
	http.HandleFunc("/ws", handleWebSocket)
	serveStaticFiles()
	url := "http://localhost:8080"
	linkText := "Click "

	link := termlink.Link(linkText, url)

	fmt.Println("Server started at: ", link)
	err := http.ListenAndServe(":8080", nil)
	if err != nil{
		fmt.Println("Failed to start err: ", err)
	}
}