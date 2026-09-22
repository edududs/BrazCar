class PlaceNotFoundError(LookupError):
    def __init__(self, place_id: str) -> None:
        super().__init__(f"no place with identifier {place_id!r}")
        self.place_id = place_id
