-- Enable real-time updates for canvas tables with full row data
ALTER TABLE canvas_nodes REPLICA IDENTITY FULL;
ALTER TABLE canvas_edges REPLICA IDENTITY FULL;